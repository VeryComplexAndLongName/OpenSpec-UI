import {
  deserializeCheckpoint,
  finalizeCheckpoint,
  rollbackCheckpoint,
  rollbackChangeCheckpoints,
  serializeCheckpoint,
  type CheckpointCoverage,
  type CheckpointDelta,
  type RollbackResult,
  type WorkbenchCheckpoint,
} from "./checkpoint.js";
import { WorkbenchProcessScheduler, type StartProcessOptions, type WorkbenchProcess } from "./process-scheduler.js";
import {
  WorkbenchRunJournal,
  type PersistedCheckpointSession,
  type WorkbenchRunJournalOptions,
} from "./workbench-run-journal.js";
import { WorkspaceLeaseManager } from "./workspace-lease.js";

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
  private readonly lease: WorkspaceLeaseManager;
  private scheduler = new WorkbenchProcessScheduler();
  private readonly sessions = new Map<string, RecoverySession>();

  private constructor(root: string, options: WorkbenchRunJournalOptions) {
    this.journal = new WorkbenchRunJournal(root, options);
    this.lease = new WorkspaceLeaseManager(root, { hostKind: "standalone-server" });
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

  /** Runs a mutating command through the scheduler's mutation lock and
   * cross-host workspace lease (docs/adr/0010-cross-host-workspace-lease.md)
   * — the standalone server's own live command execution
   * (`packages/server/src/websocket.ts`) otherwise never touched this
   * scheduler at all. Deliberately no checkpoint capture in this pass: the
   * resulting process has no rollback coverage, and a server crash mid-run
   * is not recoverable as "interrupted" with reviewable delta — only
   * mutation exclusivity is in scope here. Resolves once `execute`
   * finishes and the terminal state is persisted. */
  async runMutating(
    id: string,
    operation: string,
    changeName: string | undefined,
    execute: StartProcessOptions["execute"],
    agentId?: string,
  ): Promise<WorkbenchProcess> {
    const process = await this.scheduler.start({ id, operation, changeName, agentId, mutating: true, execute }).completion;
    await this.persist();
    return process;
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

  /** Every rollback-eligible process belonging to `changeName`, active or
   * archived — archive status lives entirely in OpenSpec's own change
   * folders, never in the checkpoint/journal system, so it plays no part
   * in eligibility here (see `rollbackChange`'s own JSDoc). */
  private changeRollbackCandidates(changeName: string): WorkbenchProcess[] {
    return [...this.sessions.values()]
      .filter((session) => session.changeName === changeName && session.checkpoint.after && session.checkpoint.delta)
      .map((session) => this.scheduler.list().find((process) => process.id === session.processId))
      .filter((process): process is WorkbenchProcess =>
        process !== undefined && ["completed", "failed", "interrupted"].includes(process.state));
  }

  /** File count and process count a `rollbackChange` call for this
   * changeName would affect, without performing the restore — for a
   * confirmation prompt before the destructive call. */
  changeRollbackDetails(changeName: string): { processCount: number; fileCount: number } | undefined {
    const processes = this.changeRollbackCandidates(changeName);
    if (processes.length === 0) return undefined;
    const paths = new Set<string>();
    for (const process of processes) {
      const checkpoint = this.sessions.get(process.id)?.checkpoint;
      for (const delta of checkpoint?.delta ?? []) paths.add(delta.path);
    }
    return { processCount: processes.length, fileCount: paths.size };
  }

  /** Rolls back every process ever run against `changeName` — active or
   * already archived — restoring every touched file to its state before
   * the earliest of those runs. Archiving a change never touches
   * checkpoint/journal data (it's a thin `openspec archive` CLI wrapper
   * scoped to `openspec/changes/`), so nothing here needs an
   * archived-change guard; this is deliberately the simpler alternative
   * to task-scoped rollback, discussed and chosen over a new
   * SQLite-backed per-task diff store — see
   * openspec/changes/change-scoped-rollback/proposal.md. */
  async rollbackChange(changeName: string): Promise<RollbackResult> {
    const processes = this.changeRollbackCandidates(changeName);
    if (processes.length === 0) throw new Error(`No rollback-eligible processes for change "${changeName}"`);
    const checkpoints = processes.map((process) => this.sessions.get(process.id)!.checkpoint);
    const result = await rollbackChangeCheckpoints(checkpoints);
    if (result.conflicts.length === 0) {
      for (const process of processes) {
        this.scheduler.markRolledBack(process.id, `change "${changeName}" rolled back: ${result.restored.length} files restored`);
      }
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
    this.scheduler = new WorkbenchProcessScheduler(retained, this.lease);
    await this.persist();
    return { removed: current.length - retained.length, retained: retained.length };
  }

  private async initialize(): Promise<void> {
    const restored = await this.journal.load();
    this.scheduler = new WorkbenchProcessScheduler(restored.processes, this.lease);
    // Still eager here, and deliberately so: `details()` is synchronous
    // and answers `delta`, `coverage` and `canRollback` out of the
    // checkpoint, so this service cannot defer the read without that
    // method becoming async and the change reaching the transport
    // protocol and both surfaces. Retention is what bounds the cost for
    // now — ten sessions rather than a hundred. Making `details()`
    // answerable from the reference alone (by persisting the small parts
    // and reading only the large `after` snapshot on rollback) is the
    // remaining half, recorded in checkpoint-retention-and-lazy-load
    // task 2.4.
    for (const persisted of restored.checkpointSessions) {
      const resolved = await persisted.loadCheckpoint();
      if (!resolved) continue;
      this.sessions.set(persisted.processId, {
        processId: persisted.processId,
        changeName: persisted.changeName,
        checkpoint: deserializeCheckpoint(resolved.checkpoint),
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
