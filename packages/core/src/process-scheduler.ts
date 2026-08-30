import {
  WORKSPACE_LEASE_RENEW_INTERVAL_MS,
  describeWorkspaceLeaseConflict,
  describeWorkspaceLeaseReclamation,
  type WorkspaceLeaseManager,
} from "./workspace-lease.js";

export type WorkbenchProcessState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "interrupted"
  | "rolled-back";

export interface WorkbenchProcess {
  id: string;
  operation: string;
  changeName?: string;
  /** Which Agentic Harness agent id ran this process, when started via a
   * harness-aware Agent Selection pick — see openspec/changes/
   * agentic-harness/. Absent for processes not tied to a specific agent
   * (e.g. plain `status`/`list`/`validate`). */
  agentId?: string;
  mutating: boolean;
  state: WorkbenchProcessState;
  createdAt: string;
  startedAt?: string;
  finishedAt?: string;
  progress?: string;
  summary?: string;
  error?: string;
}

export interface ProcessExecutionContext {
  signal: AbortSignal;
  report: (progress: string) => void;
}

export interface StartProcessOptions {
  id?: string;
  operation: string;
  changeName?: string;
  agentId?: string;
  mutating: boolean;
  execute: (context: ProcessExecutionContext) => Promise<string | void>;
}

export interface WorkbenchProcessHandle {
  id: string;
  completion: Promise<WorkbenchProcess>;
  cancel: () => boolean;
}

interface PendingProcess {
  process: WorkbenchProcess;
  controller: AbortController;
  execute: StartProcessOptions["execute"];
  resolve: (process: WorkbenchProcess) => void;
}

export class WorkbenchProcessScheduler {
  private readonly processes = new Map<string, WorkbenchProcess>();
  private readonly pending = new Map<string, PendingProcess>();
  private readonly queue: string[] = [];
  private mutationLocked = false;
  private readonly listeners = new Set<(processes: WorkbenchProcess[]) => void>();

  /** Cross-host mutation isolation (docs/adr/0010-cross-host-workspace-lease.md).
   * Optional so every existing call site/test that constructs a scheduler
   * with no real workspace root keeps its current in-memory-only behavior
   * unchanged. */
  constructor(initialProcesses: WorkbenchProcess[] = [], private readonly lease?: WorkspaceLeaseManager) {
    for (const initial of initialProcesses) {
      const process = { ...initial };
      if (process.state === "queued" || process.state === "running") {
        process.state = "interrupted";
        process.finishedAt = new Date().toISOString();
        process.error = "Workbench host stopped before this process completed";
      }
      this.processes.set(process.id, process);
    }
  }

  onDidChange(listener: (processes: WorkbenchProcess[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): WorkbenchProcess[] {
    return [...this.processes.values()].map((process) => ({ ...process }));
  }

  markRolledBack(id: string, summary?: string): boolean {
    const process = this.processes.get(id);
    if (!process || !["completed", "failed", "interrupted"].includes(process.state)) return false;
    process.state = "rolled-back";
    process.summary = summary ?? process.summary;
    this.emit();
    return true;
  }

  updateSummary(id: string, summary: string): boolean {
    const process = this.processes.get(id);
    if (!process) return false;
    process.summary = summary;
    this.emit();
    return true;
  }

  /** Removes processes created before `cutoff` in place, returning their
   * ids — for retention (`openspec-ui.checkpointRetentionDays`). Prefer
   * this over reconstructing the scheduler when the instance is shared
   * across other long-lived references (VS Code extension activation
   * wires this scheduler into several tree providers and the chat
   * participant by reference). */
  removeBefore(cutoff: Date): string[] {
    const removed: string[] = [];
    for (const [id, process] of this.processes) {
      if (Date.parse(process.createdAt) < cutoff.getTime()) {
        this.processes.delete(id);
        removed.push(id);
      }
    }
    if (removed.length > 0) this.emit();
    return removed;
  }

  start(options: StartProcessOptions): WorkbenchProcessHandle {
    const id = options.id ?? crypto.randomUUID();
    if (this.processes.has(id)) throw new Error(`Workbench process already exists: ${id}`);

    const process: WorkbenchProcess = {
      id,
      operation: options.operation,
      changeName: options.changeName,
      agentId: options.agentId,
      mutating: options.mutating,
      state: "queued",
      createdAt: new Date().toISOString(),
    };
    let resolveCompletion!: (process: WorkbenchProcess) => void;
    const completion = new Promise<WorkbenchProcess>((resolve) => {
      resolveCompletion = resolve;
    });
    this.processes.set(id, process);
    this.pending.set(id, {
      process,
      controller: new AbortController(),
      execute: options.execute,
      resolve: resolveCompletion,
    });
    this.queue.push(id);
    this.emit();
    this.drain();

    return { id, completion, cancel: () => this.cancel(id) };
  }

  cancel(id: string): boolean {
    const pending = this.pending.get(id);
    if (!pending || !["queued", "running"].includes(pending.process.state)) return false;
    pending.controller.abort();
    if (pending.process.state === "queued") {
      this.finish(pending, "cancelled");
      this.drain();
    }
    return true;
  }

  private canRun(process: WorkbenchProcess): boolean {
    return !process.mutating || !this.mutationLocked;
  }

  private drain(): void {
    for (const id of [...this.queue]) {
      const pending = this.pending.get(id);
      if (!pending || pending.process.state !== "queued" || !this.canRun(pending.process)) continue;
      this.queue.splice(this.queue.indexOf(id), 1);
      void this.run(pending);
    }
  }

  private async run(pending: PendingProcess): Promise<void> {
    const process = pending.process;
    const leasedMutation = process.mutating && this.lease !== undefined;

    if (leasedMutation) {
      const result = await this.lease!.acquireOrRenew();
      if (!result.ok) {
        // Never transitions through "running" — another host holds the
        // workspace, so this run never actually starts.
        process.error = describeWorkspaceLeaseConflict(result.conflict);
        this.finish(pending, "failed");
        this.drain();
        return;
      }
      if (result.reclaimedFrom) {
        process.progress = describeWorkspaceLeaseReclamation(result.reclaimedFrom);
      }
    }

    if (process.mutating) this.mutationLocked = true;
    process.state = "running";
    process.startedAt = new Date().toISOString();
    this.emit();

    const renewTimer = leasedMutation
      ? setInterval(() => {
          void this.lease!.acquireOrRenew().catch(() => undefined);
        }, WORKSPACE_LEASE_RENEW_INTERVAL_MS)
      : undefined;

    // `finish()` (which resolves `completion`) is deliberately called after
    // this try/catch/finally, not inside it: releasing the lease is
    // asynchronous, and a caller awaiting `completion` before starting
    // another mutating run (exactly the cross-host scenario this lease
    // exists for) must be able to rely on all of this run's cleanup —
    // including the lease release — having already happened.
    let terminalState: WorkbenchProcessState;
    try {
      const summary = await pending.execute({
        signal: pending.controller.signal,
        report: (progress) => {
          process.progress = progress;
          this.emit();
        },
      });
      if (pending.controller.signal.aborted) {
        terminalState = "cancelled";
      } else {
        if (summary !== undefined) process.summary = summary;
        terminalState = "completed";
      }
    } catch (error) {
      if (pending.controller.signal.aborted) {
        terminalState = "cancelled";
      } else {
        process.error = error instanceof Error ? error.message : String(error);
        terminalState = "failed";
      }
    } finally {
      if (renewTimer) clearInterval(renewTimer);
      if (process.mutating) this.mutationLocked = false;
      if (leasedMutation) await this.lease!.release();
    }
    this.finish(pending, terminalState);
    this.drain();
  }

  private finish(pending: PendingProcess, state: WorkbenchProcessState): void {
    pending.process.state = state;
    pending.process.finishedAt = new Date().toISOString();
    this.pending.delete(pending.process.id);
    const queueIndex = this.queue.indexOf(pending.process.id);
    if (queueIndex >= 0) this.queue.splice(queueIndex, 1);
    this.emit();
    pending.resolve({ ...pending.process });
  }

  private emit(): void {
    const snapshot = this.list();
    for (const listener of this.listeners) listener(snapshot);
  }
}
