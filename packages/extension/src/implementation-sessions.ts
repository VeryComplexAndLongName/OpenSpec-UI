import {
  captureCheckpoint,
  finalizeCheckpoint,
  rollbackCheckpoint,
  type CheckpointDelta,
  type WorkbenchCheckpoint,
  type WorkbenchProcessScheduler,
} from "@openspec-ui/core";

interface ImplementationSession {
  processId: string;
  changeName: string;
  checkpoint: WorkbenchCheckpoint;
  finish: () => void;
  completion: Promise<void>;
  delta?: CheckpointDelta[];
}

export class ImplementationSessionManager {
  private readonly sessions = new Map<string, ImplementationSession>();

  constructor(private readonly scheduler: WorkbenchProcessScheduler) {}

  async start(root: string, changeName: string): Promise<string> {
    const checkpoint = await captureCheckpoint(root);
    let finish!: () => void;
    const completion = new Promise<void>((resolve) => { finish = resolve; });
    const processId = crypto.randomUUID();
    const session: ImplementationSession = { processId, changeName, checkpoint, finish, completion };
    this.sessions.set(processId, session);
    this.scheduler.start({
      id: processId,
      operation: "implement",
      changeName,
      mutating: true,
      execute: async ({ report, signal }) => {
        report("Working in VS Code Agent mode");
        await Promise.race([
          completion,
          new Promise<void>((resolve) => signal.addEventListener("abort", () => resolve(), { once: true })),
        ]);
        if (signal.aborted) return "Implementation session cancelled";
        session.delta = await finalizeCheckpoint(checkpoint);
        return `${session.delta.length} changed file${session.delta.length === 1 ? "" : "s"} ready for review`;
      },
    });
    return processId;
  }

  finish(processId: string): boolean {
    const session = this.sessions.get(processId);
    if (!session) return false;
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
}
