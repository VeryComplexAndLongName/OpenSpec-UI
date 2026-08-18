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
  type RollbackResult,
  type StartProcessOptions,
  type WorkbenchCheckpoint,
  type WorkbenchProcess,
  type WorkbenchProcessScheduler,
} from "@openspec-ui/core";

interface CheckpointSession {
  processId: string;
  changeName?: string;
  checkpoint: WorkbenchCheckpoint;
  finish?: () => void;
  delta?: CheckpointDelta[];
}

export class ImplementationSessionManager {
  private readonly sessions = new Map<string, CheckpointSession>();

  constructor(
    private readonly scheduler: WorkbenchProcessScheduler,
    private readonly onDidChange: () => void = () => undefined,
  ) { }

  async restore(persisted: PersistedCheckpointSession[]): Promise<void> {
    for (const item of persisted) {
      const checkpoint = deserializeCheckpoint(item.checkpoint);
      const session: CheckpointSession = {
        processId: item.processId,
        changeName: item.changeName,
        checkpoint,
        delta: checkpoint.delta,
      };
      this.sessions.set(item.processId, session);
      const process = this.scheduler.list().find((candidate) => candidate.id === item.processId);
      if (process?.state === "interrupted" && !session.delta) {
        session.delta = await finalizeCheckpoint(checkpoint);
        this.scheduler.updateSummary(item.processId, this.describeDelta(session));
      }
    }
    this.onDidChange();
  }

  exportPersisted(): PersistedCheckpointSession[] {
    return [...this.sessions.values()].map((session) => ({
      processId: session.processId,
      changeName: session.changeName,
      checkpoint: serializeCheckpoint(session.checkpoint),
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
          session = { processId: handle.id, changeName: options.changeName, checkpoint };
          this.sessions.set(handle.id, session);
          this.onDidChange();
        }
        report("Running");
        try {
          return await options.execute();
        } finally {
          if (session) {
            session.delta = await finalizeCheckpoint(session.checkpoint);
            this.scheduler.updateSummary(session.processId, this.describeDelta(session));
            this.onDidChange();
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
          const session: CheckpointSession = { processId, changeName, checkpoint, finish };
          this.sessions.set(processId, session);
          this.onDidChange();
          markReady();
          report("Working in VS Code Agent mode");
          await Promise.race([
            completion,
            new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true })),
          ]);
          session.delta = await finalizeCheckpoint(checkpoint);
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
    if (!session?.delta) throw new Error("Implementation session is not ready for rollback");
    const result = await rollbackCheckpoint(session.checkpoint);
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
  private changeRollbackCandidates(changeName: string): CheckpointSession[] {
    return [...this.sessions.values()]
      .filter((session) => session.changeName === changeName && session.delta)
      .map((session) => ({ session, process: this.scheduler.list().find((candidate) => candidate.id === session.processId) }))
      .filter((entry): entry is { session: CheckpointSession; process: WorkbenchProcess } =>
        entry.process !== undefined && ["completed", "failed", "interrupted"].includes(entry.process.state))
      .map((entry) => entry.session);
  }

  changeRollbackDetails(changeName: string): { processCount: number; fileCount: number } | undefined {
    const sessions = this.changeRollbackCandidates(changeName);
    if (sessions.length === 0) return undefined;
    const paths = new Set<string>();
    for (const session of sessions) for (const delta of session.delta ?? []) paths.add(delta.path);
    return { processCount: sessions.length, fileCount: paths.size };
  }

  async rollbackChange(changeName: string): Promise<RollbackResult> {
    const sessions = this.changeRollbackCandidates(changeName);
    if (sessions.length === 0) throw new Error(`No rollback-eligible processes for change "${changeName}"`);
    const result = await rollbackChangeCheckpoints(sessions.map((session) => session.checkpoint));
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

  getDelta(processId: string): CheckpointDelta[] | undefined {
    return this.sessions.get(processId)?.delta?.map((item) => ({ ...item }));
  }

  getCoverage(processId: string): CheckpointCoverage | undefined {
    const coverage = this.sessions.get(processId)?.checkpoint.coverage;
    return coverage ? {
      excludedDirectories: [...coverage.excludedDirectories],
      skippedFiles: [...coverage.skippedFiles],
    } : undefined;
  }

  private describeDelta(session: CheckpointSession): string {
    const count = session.delta?.length ?? 0;
    const partial = session.checkpoint.coverage.skippedFiles.length > 0 ? "; partial checkpoint coverage" : "";
    return `${count} changed file${count === 1 ? "" : "s"} ready for review${partial}`;
  }
}
