import {
  captureCheckpoint,
  deserializeCheckpoint,
  finalizeCheckpoint,
  rollbackCheckpoint,
  serializeCheckpoint,
  type CheckpointDelta,
  type CheckpointCoverage,
  type PersistedCheckpointSession,
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
