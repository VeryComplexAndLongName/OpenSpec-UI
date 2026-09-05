import {
  captureCheckpoint,
  deserializeCheckpoint,
  finalizeCheckpoint,
  rollbackCheckpoint,
  rollbackChangeCheckpoints,
  serializeCheckpoint,
  type CheckpointDelta,
  type CheckpointCoverage,
  type PersistedCheckpointSession,
  type RestoredCheckpointSession,
  type RollbackResult,
  type StartProcessOptions,
  type WorkbenchCheckpoint,
  type WorkbenchRunJournalSessionToSave,
  type WorkbenchProcess,
  type WorkbenchProcessScheduler,
} from "@openspec-ui/core";

interface CheckpointSession {
  processId: string;
  changeName?: string;
  hasAfter?: boolean;
  checkpoint?: WorkbenchCheckpoint;
  loadCheckpoint?: () => Promise<PersistedCheckpointSession | undefined>;
  finish?: () => void;
  delta?: CheckpointDelta[];
  coverage?: CheckpointCoverage;
  loadInFlight?: Promise<WorkbenchCheckpoint | undefined>;
}

export class ImplementationSessionManager {
  private readonly sessions = new Map<string, CheckpointSession>();

  constructor(
    private readonly scheduler: WorkbenchProcessScheduler,
    private readonly onDidChange: () => void = () => undefined,
  ) { }

  /** Restores references eagerly and payloads lazily. The only startup
   * payload read is an `interrupted` process with no persisted delta,
   * because that is the path that must be finalized immediately to remain
   * reviewable after restart. */
  async restore(persisted: RestoredCheckpointSession[]): Promise<void> {
    const interrupted = new Set(
      this.scheduler.list()
        .filter((process) => process.state === "interrupted")
        .map((process) => process.id),
    );
    for (const item of persisted) {
      const session: CheckpointSession = {
        processId: item.processId,
        changeName: item.changeName,
        hasAfter: item.hasAfter,
        delta: item.delta?.map((entry) => ({ ...entry })),
        coverage: item.coverage ? {
          excludedDirectories: [...item.coverage.excludedDirectories],
          skippedFiles: [...item.coverage.skippedFiles],
        } : undefined,
        loadCheckpoint: item.loadCheckpoint,
      };
      this.sessions.set(item.processId, session);
      if (!interrupted.has(item.processId) || session.delta) continue;
      const checkpoint = await this.ensureCheckpoint(session);
      if (!checkpoint) continue;
      if (!session.delta) {
        session.delta = await finalizeCheckpoint(checkpoint);
        session.hasAfter = true;
        this.scheduler.updateSummary(item.processId, this.describeDelta(session));
      }
    }
    this.onDidChange();
  }

  exportPersisted(): WorkbenchRunJournalSessionToSave[] {
    return [...this.sessions.values()].map((session) => ({
      processId: session.processId,
      changeName: session.changeName,
      hasAfter: session.hasAfter,
      delta: session.delta?.map((item) => ({ ...item })),
      coverage: session.coverage ? {
        excludedDirectories: [...session.coverage.excludedDirectories],
        skippedFiles: [...session.coverage.skippedFiles],
      } : undefined,
      checkpoint: session.checkpoint ? serializeCheckpoint(session.checkpoint) : undefined,
    }));
  }

  async run(
    root: string,
    options: Omit<StartProcessOptions, "execute"> & { execute: () => Promise<string | void> },
  ): Promise<WorkbenchProcess> {
    let session: CheckpointSession | undefined;
    const handle = this.scheduler.start({
      ...options,
      execute: async ({ report }) => {
        if (options.mutating) {
          const checkpoint = await captureCheckpoint(root);
          session = {
            processId: handle.id,
            changeName: options.changeName,
            checkpoint,
            hasAfter: false,
            coverage: {
              excludedDirectories: [...checkpoint.coverage.excludedDirectories],
              skippedFiles: [...checkpoint.coverage.skippedFiles],
            },
          };
          this.sessions.set(handle.id, session);
          this.onDidChange();
        }
        report("Running");
        try {
          return await options.execute();
        } finally {
          if (session) {
            const checkpoint = session.checkpoint;
            if (checkpoint) {
              session.delta = await finalizeCheckpoint(checkpoint);
              session.hasAfter = true;
              this.scheduler.updateSummary(session.processId, this.describeDelta(session));
              this.onDidChange();
            }
          }
        }
      },
    });
    return handle.completion;
  }

  async start(root: string, changeName: string): Promise<string> {
    let finish!: () => void;
    const completion = new Promise<void>((resolve) => { finish = resolve; });
    const processId = crypto.randomUUID();
    let markReady!: () => void;
    let rejectReady!: (error: unknown) => void;
    const ready = new Promise<void>((resolve, reject) => { markReady = resolve; rejectReady = reject; });
    this.scheduler.start({
      id: processId,
      operation: "implement",
      changeName,
      mutating: true,
      execute: async ({ report, signal }) => {
        try {
          const checkpoint = await captureCheckpoint(root);
          const session: CheckpointSession = {
            processId,
            changeName,
            checkpoint,
            finish,
            hasAfter: false,
            coverage: {
              excludedDirectories: [...checkpoint.coverage.excludedDirectories],
              skippedFiles: [...checkpoint.coverage.skippedFiles],
            },
          };
          this.sessions.set(processId, session);
          this.onDidChange();
          markReady();
          report("Working in VS Code Agent mode");
          await Promise.race([
            completion,
            new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true })),
          ]);
          session.delta = await finalizeCheckpoint(checkpoint);
          session.hasAfter = true;
          this.onDidChange();
          if (signal.aborted) return "Implementation session cancelled";
          return this.describeDelta(session);
        } catch (error) {
          rejectReady(error);
          throw error;
        }
      },
    });
    await ready;
    return processId;
  }

  finish(processId: string): boolean {
    const session = this.sessions.get(processId);
    if (!session?.finish) return false;
    session.finish();
    return true;
  }

  cancel(processId: string): boolean {
    return this.scheduler.cancel(processId);
  }

  async rollback(processId: string) {
    const session = this.sessions.get(processId);
    if (!session) throw new Error("Implementation session is not ready for rollback");
    const checkpoint = await this.ensureCheckpoint(session);
    if (!checkpoint || !session.delta) throw new Error("Implementation session is not ready for rollback");
    const result = await rollbackCheckpoint(checkpoint);
    if (result.conflicts.length === 0) {
      this.scheduler.markRolledBack(processId, `${result.restored.length} files restored`);
    }
    return result;
  }

  /** Every rollback-eligible session belonging to `changeName`, active or
   * archived — same eligibility rule as `WorkbenchRecoveryService`'s
   * mirror of this method (`@openspec-ui/core`), duplicated here because
   * the extension's primary mode keeps its own session map instead of
   * going through that service (see module header). */
  private async changeRollbackCandidates(changeName: string): Promise<CheckpointSession[]> {
    const byId = new Map(this.scheduler.list().map((process) => [process.id, process]));
    const candidates = [...this.sessions.values()]
      .map((session) => ({ session, process: byId.get(session.processId) }))
      .filter((entry): entry is { session: CheckpointSession; process: WorkbenchProcess } =>
        entry.process !== undefined
        && entry.session.changeName === changeName
        && ["completed", "failed", "interrupted"].includes(entry.process.state));

    const rollbackable: CheckpointSession[] = [];
    for (const entry of candidates) {
      const delta = await this.ensureDelta(entry.session);
      if (!delta || !entry.session.hasAfter) continue;
      rollbackable.push(entry.session);
    }
    return rollbackable;
  }

  async changeRollbackDetails(changeName: string): Promise<{ processCount: number; fileCount: number } | undefined> {
    const sessions = await this.changeRollbackCandidates(changeName);
    if (sessions.length === 0) return undefined;
    const paths = new Set<string>();
    for (const session of sessions) for (const delta of session.delta ?? []) paths.add(delta.path);
    return { processCount: sessions.length, fileCount: paths.size };
  }

  async rollbackChange(changeName: string): Promise<RollbackResult> {
    const sessions = await this.changeRollbackCandidates(changeName);
    if (sessions.length === 0) throw new Error(`No rollback-eligible processes for change "${changeName}"`);
    const checkpoints: WorkbenchCheckpoint[] = [];
    for (const session of sessions) {
      const checkpoint = await this.ensureCheckpoint(session);
      if (!checkpoint || !session.delta || !session.hasAfter) continue;
      checkpoints.push(checkpoint);
    }
    if (checkpoints.length === 0) throw new Error(`No rollback-eligible processes for change "${changeName}"`);
    const result = await rollbackChangeCheckpoints(checkpoints);
    if (result.conflicts.length === 0) {
      for (const session of sessions) {
        this.scheduler.markRolledBack(session.processId, `change "${changeName}" rolled back: ${result.restored.length} files restored`);
      }
    }
    return result;
  }

  /** Retention pruning (`openspec-ui.checkpointRetentionDays`) — drops
   * sessions whose process was removed from the scheduler by
   * `WorkbenchProcessScheduler.removeBefore`. */
  dropSessions(processIds: readonly string[]): void {
    for (const id of processIds) this.sessions.delete(id);
  }

  async getDelta(processId: string): Promise<CheckpointDelta[] | undefined> {
    const session = this.sessions.get(processId);
    const delta = await this.ensureDelta(session);
    return delta?.map((item) => ({ ...item }));
  }

  async getCoverage(processId: string): Promise<CheckpointCoverage | undefined> {
    const session = this.sessions.get(processId);
    if (!session) return undefined;
    if (!session.coverage) {
      const checkpoint = await this.ensureCheckpoint(session);
      session.coverage = checkpoint ? {
        excludedDirectories: [...checkpoint.coverage.excludedDirectories],
        skippedFiles: [...checkpoint.coverage.skippedFiles],
      } : undefined;
    }
    const coverage = session.coverage;
    return coverage ? {
      excludedDirectories: [...coverage.excludedDirectories],
      skippedFiles: [...coverage.skippedFiles],
    } : undefined;
  }

  private async ensureCheckpoint(session: CheckpointSession | undefined): Promise<WorkbenchCheckpoint | undefined> {
    if (!session) return undefined;
    if (session.checkpoint) return session.checkpoint;
    if (!session.loadCheckpoint) return undefined;
    if (!session.loadInFlight) {
      session.loadInFlight = (async () => {
        const restored = await session.loadCheckpoint?.();
        if (!restored) return undefined;
        const checkpoint = deserializeCheckpoint(restored.checkpoint);
        session.checkpoint = checkpoint;
        session.hasAfter = session.hasAfter ?? Boolean(checkpoint.after);
        session.delta = session.delta ?? checkpoint.delta?.map((item) => ({ ...item }));
        session.coverage = session.coverage ?? {
          excludedDirectories: [...checkpoint.coverage.excludedDirectories],
          skippedFiles: [...checkpoint.coverage.skippedFiles],
        };
        return checkpoint;
      })().finally(() => {
        session.loadInFlight = undefined;
      });
    }
    return session.loadInFlight;
  }

  private async ensureDelta(session: CheckpointSession | undefined): Promise<CheckpointDelta[] | undefined> {
    if (!session) return undefined;
    if (session.delta) return session.delta;
    const checkpoint = await this.ensureCheckpoint(session);
    if (!checkpoint?.delta) return undefined;
    session.delta = checkpoint.delta.map((item) => ({ ...item }));
    return session.delta;
  }

  private describeDelta(session: CheckpointSession): string {
    const count = session.delta?.length ?? 0;
    const skipped = session.coverage?.skippedFiles.length ?? session.checkpoint?.coverage.skippedFiles.length ?? 0;
    const partial = skipped > 0 ? "; partial checkpoint coverage" : "";
    return `${count} changed file${count === 1 ? "" : "s"} ready for review${partial}`;
  }
}
