import {
  deserializeCheckpoint,
  finalizeCheckpoint,
  rollbackCheckpoint,
  serializeCheckpoint,
  type CheckpointCoverage,
  type CheckpointDelta,
  type RollbackResult,
  type WorkbenchCheckpoint,
} from "./checkpoint.js";
import { WorkbenchProcessScheduler, type WorkbenchProcess } from "./process-scheduler.js";
import {
  WorkbenchRunJournal,
  type PersistedCheckpointSession,
  type WorkbenchRunJournalOptions,
} from "./workbench-run-journal.js";

interface RecoverySession {
  processId: string;
  changeName?: string;
  checkpoint: WorkbenchCheckpoint;
}

export interface WorkbenchRecoveryDetails {
  process: WorkbenchProcess;
  delta?: CheckpointDelta[];
  coverage?: CheckpointCoverage;
  canRollback: boolean;
}

export interface WorkbenchCleanupResult {
  removed: number;
  retained: number;
}

export class WorkbenchRecoveryService {
  private readonly journal: WorkbenchRunJournal;
  private scheduler = new WorkbenchProcessScheduler();
  private readonly sessions = new Map<string, RecoverySession>();

  private constructor(root: string, options: WorkbenchRunJournalOptions) {
    this.journal = new WorkbenchRunJournal(root, options);
  }

  static async open(
    root: string,
    options: WorkbenchRunJournalOptions = {},
  ): Promise<WorkbenchRecoveryService> {
    const service = new WorkbenchRecoveryService(root, options);
    await service.initialize();
    return service;
  }

  list(): WorkbenchProcess[] {
    return this.scheduler.list().sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));
  }

  details(processId: string): WorkbenchRecoveryDetails | undefined {
    const process = this.scheduler.list().find((candidate) => candidate.id === processId);
    if (!process) return undefined;
    const checkpoint = this.sessions.get(processId)?.checkpoint;
    return {
      process,
      delta: checkpoint?.delta?.map((item) => ({ ...item })),
      coverage: checkpoint ? {
        excludedDirectories: [...checkpoint.coverage.excludedDirectories],
        skippedFiles: [...checkpoint.coverage.skippedFiles],
      } : undefined,
      canRollback: Boolean(checkpoint?.after && checkpoint.delta && ["completed", "failed", "interrupted"].includes(process.state)),
    };
  }

  async rollback(processId: string): Promise<RollbackResult> {
    const details = this.details(processId);
    const session = this.sessions.get(processId);
    if (!details?.canRollback || !session) throw new Error("Process is not ready for rollback");
    const result = await rollbackCheckpoint(session.checkpoint);
    if (result.conflicts.length === 0) {
      this.scheduler.markRolledBack(processId, `${result.restored.length} files restored`);
      await this.persist();
    }
    return result;
  }

  async cleanupBefore(cutoff: Date): Promise<WorkbenchCleanupResult> {
    if (Number.isNaN(cutoff.getTime())) throw new Error("Invalid cleanup cutoff");
    const current = this.scheduler.list();
    const retained = current.filter((process) => Date.parse(process.createdAt) >= cutoff.getTime());
    const retainedIds = new Set(retained.map((process) => process.id));
    for (const processId of this.sessions.keys()) {
      if (!retainedIds.has(processId)) this.sessions.delete(processId);
    }
    this.scheduler = new WorkbenchProcessScheduler(retained);
    await this.persist();
    return { removed: current.length - retained.length, retained: retained.length };
  }

  private async initialize(): Promise<void> {
    const restored = await this.journal.load();
    this.scheduler = new WorkbenchProcessScheduler(restored.processes);
    for (const persisted of restored.checkpointSessions) {
      this.sessions.set(persisted.processId, {
        processId: persisted.processId,
        changeName: persisted.changeName,
        checkpoint: deserializeCheckpoint(persisted.checkpoint),
      });
    }

    for (const process of this.scheduler.list()) {
      const session = this.sessions.get(process.id);
      if (process.state !== "interrupted" || !session || session.checkpoint.delta) continue;
      const delta = await finalizeCheckpoint(session.checkpoint);
      this.scheduler.updateSummary(process.id, `${delta.length} changed file${delta.length === 1 ? "" : "s"} ready for review`);
    }
    await this.persist();
  }

  private persist(): Promise<void> {
    const checkpointSessions: PersistedCheckpointSession[] = [...this.sessions.values()].map((session) => ({
      processId: session.processId,
      changeName: session.changeName,
      checkpoint: serializeCheckpoint(session.checkpoint),
    }));
    return this.journal.save({ processes: this.scheduler.list(), checkpointSessions });
  }
}
