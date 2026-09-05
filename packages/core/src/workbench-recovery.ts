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
  type WorkbenchRunJournalSessionToSave,
  type WorkbenchRunJournalOptions,
} from "./workbench-run-journal.js";
import { WorkspaceLeaseManager } from "./workspace-lease.js";

interface RecoverySession {
  processId: string;
  changeName?: string;
  hasAfter?: boolean;
  checkpoint?: WorkbenchCheckpoint;
  loadCheckpoint?: () => Promise<PersistedCheckpointSession | undefined>;
  delta?: CheckpointDelta[];
  coverage?: CheckpointCoverage;
  loadInFlight?: Promise<WorkbenchCheckpoint | undefined>;
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

  async details(processId: string): Promise<WorkbenchRecoveryDetails | undefined> {
    const process = this.scheduler.list().find((candidate) => candidate.id === processId);
    if (!process) return undefined;
    const session = this.sessions.get(processId);
    if (!session) return { process, canRollback: false };

    let delta = session.delta;
    let coverage = session.coverage;
    let hasAfter = session.hasAfter;
    if (delta === undefined || coverage === undefined || hasAfter === undefined) {
      const checkpoint = await this.ensureCheckpoint(session);
      if (checkpoint) {
        delta = delta ?? checkpoint.delta?.map((item) => ({ ...item }));
        coverage = coverage ?? {
          excludedDirectories: [...checkpoint.coverage.excludedDirectories],
          skippedFiles: [...checkpoint.coverage.skippedFiles],
        };
        hasAfter = hasAfter ?? Boolean(checkpoint.after);
      }
    }

    return {
      process,
      delta: delta?.map((item) => ({ ...item })),
      coverage: coverage ? {
        excludedDirectories: [...coverage.excludedDirectories],
        skippedFiles: [...coverage.skippedFiles],
      } : undefined,
      canRollback: Boolean(hasAfter && delta && ["completed", "failed", "interrupted"].includes(process.state)),
    };
  }

  async rollback(processId: string): Promise<RollbackResult> {
    const details = await this.details(processId);
    const session = this.sessions.get(processId);
    const checkpoint = await this.ensureCheckpoint(session);
    if (!details?.canRollback || !checkpoint) throw new Error("Process is not ready for rollback");
    const result = await rollbackCheckpoint(checkpoint);
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
  private async changeRollbackCandidates(changeName: string): Promise<RecoverySession[]> {
    const byId = new Map(this.scheduler.list().map((process) => [process.id, process]));
    const eligible: RecoverySession[] = [];
    for (const session of this.sessions.values()) {
      if (session.changeName !== changeName) continue;
      const process = byId.get(session.processId);
      if (!process || !["completed", "failed", "interrupted"].includes(process.state)) continue;
      const details = await this.details(session.processId);
      if (!details?.canRollback) continue;
      eligible.push(session);
    }
    return eligible;
  }

  /** File count and process count a `rollbackChange` call for this
   * changeName would affect, without performing the restore — for a
   * confirmation prompt before the destructive call. */
  async changeRollbackDetails(changeName: string): Promise<{ processCount: number; fileCount: number } | undefined> {
    const sessions = await this.changeRollbackCandidates(changeName);
    if (sessions.length === 0) return undefined;
    const paths = new Set<string>();
    for (const session of sessions) {
      for (const delta of session.delta ?? []) paths.add(delta.path);
    }
    return { processCount: sessions.length, fileCount: paths.size };
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
    for (const persisted of restored.checkpointSessions) {
      this.sessions.set(persisted.processId, {
        processId: persisted.processId,
        changeName: persisted.changeName,
        hasAfter: persisted.hasAfter,
        delta: persisted.delta?.map((item) => ({ ...item })),
        coverage: persisted.coverage ? {
          excludedDirectories: [...persisted.coverage.excludedDirectories],
          skippedFiles: [...persisted.coverage.skippedFiles],
        } : undefined,
        loadCheckpoint: persisted.loadCheckpoint,
      });
    }

    for (const process of this.scheduler.list()) {
      const session = this.sessions.get(process.id);
      if (process.state !== "interrupted" || !session || session.delta) continue;
      const checkpoint = await this.ensureCheckpoint(session);
      if (!checkpoint) continue;
      const delta = await finalizeCheckpoint(checkpoint);
      session.delta = delta;
      session.hasAfter = true;
      this.scheduler.updateSummary(process.id, `${delta.length} changed file${delta.length === 1 ? "" : "s"} ready for review`);
    }
    await this.persist();
  }

  private persist(): Promise<void> {
    const checkpointSessions: WorkbenchRunJournalSessionToSave[] = [...this.sessions.values()].map((session) => ({
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
    return this.journal.save({ processes: this.scheduler.list(), checkpointSessions });
  }

  private async ensureCheckpoint(session: RecoverySession | undefined): Promise<WorkbenchCheckpoint | undefined> {
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
}
