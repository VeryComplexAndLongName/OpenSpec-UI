import type { AgentUsage } from "./agent-usage.js";
import {
  WORKSPACE_LEASE_RENEW_INTERVAL_MS,
  describeWorkspaceLeaseConflict,
  describeWorkspaceLeaseReclamation,
  type WorkspaceLeaseManager,
} from "./workspace-lease.js";

export type WorkbenchProcessState =
  | "queued"
  | "running"
  | "suspended"
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
  /** What a `"suspended"` process is waiting for — set by `suspend()` and
   * cleared by `resumeProcess()`. This is what a UI renders; a suspended
   * process with no stated reason is indistinguishable from a stalled
   * one. Absent for any process that has never suspended. */
  waitingFor?: string;
  /** This process's recorded resource usage, when its audit entry carries
   * one (see security.ts's `AuditEntry.usage`) — read from the audit log
   * for display, never stored there as the source of truth (see
   * openspec/changes/agent-usage-accounting/design.md, "Rejected
   * alternative: extend WorkbenchProcess"). Absent — not zero — for a
   * process whose run reported no usage; a host must not render `$0.00`
   * for it. Nothing in this project populates this field yet: no adapter
   * produces `AuditEntry.usage` until `acp-agent-adapters` lands. */
  usage?: AgentUsage;
}

export interface ProcessExecutionContext {
  signal: AbortSignal;
  report: (progress: string) => void;
  /** Suspends this execution until `resumeProcess(id)` is called, releasing
   * the workspace mutation lock (and the cross-host lease, where one is
   * configured) for as long as it waits — see
   * openspec/changes/harness-suspendable-stage/design.md. Resolves once
   * resumed and re-admitted; rejects if `timeoutMs` elapses first or if
   * the process is cancelled while suspended. */
  suspend: (reason: string, options: { timeoutMs: number }) => Promise<void>;
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

/** Bookkeeping for one pending suspend() call — created when an execution
 * suspends and cleared the moment it settles (resumed, timed out, or
 * cancelled). Its mere presence on a `PendingProcess` is also how `drain()`
 * tells a resumed process (re-enter the still-running `execute()` call)
 * apart from one that has never started (call `execute()` for the first
 * time), and how `cancel()` tells a suspended-or-resuming process (reject
 * the suspend() promise) apart from one whose `execute()` has not started
 * suspending at all. */
interface PendingSuspension {
  reason: string;
  resolveResume: () => void;
  rejectResume: (error: Error) => void;
}

interface PendingProcess {
  process: WorkbenchProcess;
  controller: AbortController;
  execute: StartProcessOptions["execute"];
  resolve: (process: WorkbenchProcess) => void;
  /** Set at the top of every `run()`/`resumeRun()` attempt so `suspend()`
   * and the eventual `finally` in `run()` — which keeps executing across a
   * suspend/resume cycle, since resuming does not call `execute()` again —
   * always see this run's *current* lease renewal timer and lease flag,
   * not a stale value captured before the process last suspended. */
  renewTimer?: ReturnType<typeof setInterval>;
  leasedMutation?: boolean;
  suspension?: PendingSuspension;
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
      } else if (process.state === "suspended") {
        // Not restored as suspended — see design.md, "A suspension does not
        // survive a host restart": the poller and the in-memory promise
        // `suspend()` was awaiting belonged to the host that is gone, so
        // this process could never be resumed.
        process.state = "interrupted";
        process.finishedAt = new Date().toISOString();
        process.error = `Workbench host stopped while this process was waiting for: ${process.waitingFor ?? "an external signal"}`;
        process.waitingFor = undefined;
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
    if (!pending) return false;
    // A suspended process, or one requeued after `resumeProcess()` but not
    // yet re-admitted, is still inside the original `run()` call's
    // try/catch — that call is simply parked on the promise `suspend()`
    // returned. Rejecting that promise (after aborting, so `run()`'s catch
    // block reports "cancelled" rather than "failed") lets that same
    // try/catch/finally finish the process exactly once; calling
    // `finish()` here too would race it and finish the process twice.
    if (pending.suspension) {
      pending.controller.abort();
      pending.suspension.rejectResume(new Error("Process was cancelled while suspended"));
      return true;
    }
    if (!["queued", "running"].includes(pending.process.state)) return false;
    pending.controller.abort();
    if (pending.process.state === "queued") {
      this.finish(pending, "cancelled");
      this.drain();
    }
    return true;
  }

  /** Returns `false` for a process that is not currently suspended. A
   * resumed process re-enters the queue rather than resuming directly into
   * "running" — see design.md, "A resumed process re-enters the queue" —
   * so that two processes suspended at once can never both resume into a
   * mutation at the same time. */
  resumeProcess(id: string): boolean {
    const pending = this.pending.get(id);
    if (!pending || pending.process.state !== "suspended") return false;
    pending.process.state = "queued";
    pending.process.waitingFor = undefined;
    this.queue.push(id);
    this.emit();
    this.drain();
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
      // `pending.suspension` still present means this id was requeued by
      // `resumeProcess()`, not started fresh by `start()` — re-admit it
      // into the `execute()` call already in flight instead of invoking
      // `execute()` a second time.
      if (pending.suspension) {
        void this.resumeRun(pending);
      } else {
        void this.run(pending);
      }
    }
  }

  /** Suspends `pending`'s in-flight execution until `resumeProcess(pending.
   * process.id)` is called, releasing the in-process mutation lock and the
   * cross-host lease (when configured) for the duration — see
   * design.md's "Suspension releases the cross-host lease" and "Every
   * suspension is bounded". Rejects on timeout or on `cancel()`. */
  private async suspend(pending: PendingProcess, reason: string, options: { timeoutMs: number }): Promise<void> {
    const process = pending.process;
    if (pending.renewTimer) {
      clearInterval(pending.renewTimer);
      pending.renewTimer = undefined;
    }
    if (process.mutating) this.mutationLocked = false;
    if (pending.leasedMutation) await this.lease!.release();

    process.state = "suspended";
    process.waitingFor = reason;
    this.emit();

    return new Promise<void>((resolve, reject) => {
      const timeoutHandle = setTimeout(() => {
        pending.suspension = undefined;
        reject(new Error(`Suspension timed out after ${options.timeoutMs}ms waiting for: ${reason}`));
      }, options.timeoutMs);
      pending.suspension = {
        reason,
        resolveResume: () => {
          clearTimeout(timeoutHandle);
          pending.suspension = undefined;
          resolve();
        },
        rejectResume: (error: Error) => {
          clearTimeout(timeoutHandle);
          pending.suspension = undefined;
          reject(error);
        },
      };
      // Releasing the lock above changes nothing on its own — nothing else
      // re-examines the queue until some unrelated process finishes. Since
      // this process no longer holds it, another queued mutation must be
      // considered right away.
      this.drain();
    });
  }

  /** Re-admits a process that suspended and was then resumed: reacquires
   * the cross-host lease (when configured) and the in-process lock, then
   * unblocks the `suspend()` call the original `run()` invocation is still
   * parked on — it does not call `execute()` again. A lease that cannot be
   * reacquired leaves the process queued rather than proceeding unlocked;
   * see design.md, "resume must re-acquire it". */
  private async resumeRun(pending: PendingProcess): Promise<void> {
    const process = pending.process;
    const leasedMutation = process.mutating && this.lease !== undefined;
    pending.leasedMutation = leasedMutation;

    if (leasedMutation) {
      const result = await this.lease!.acquireOrRenew();
      if (!result.ok) {
        this.queue.push(process.id);
        this.emit();
        return;
      }
      if (result.reclaimedFrom) {
        process.progress = describeWorkspaceLeaseReclamation(result.reclaimedFrom);
      }
    }

    if (process.mutating) this.mutationLocked = true;
    process.state = "running";
    this.emit();

    pending.renewTimer = leasedMutation
      ? setInterval(() => {
          void this.lease!.acquireOrRenew().catch(() => undefined);
        }, WORKSPACE_LEASE_RENEW_INTERVAL_MS)
      : undefined;

    pending.suspension?.resolveResume();
  }

  private async run(pending: PendingProcess): Promise<void> {
    const process = pending.process;
    const leasedMutation = process.mutating && this.lease !== undefined;
    pending.leasedMutation = leasedMutation;

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

    pending.renewTimer = leasedMutation
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
    //
    // This same try/catch/finally spans a suspend/resume cycle: `suspend()`
    // parks the promise `pending.execute()` is awaiting internally without
    // this `await` below ever observing it settle, so a resumed process
    // re-enters here (via `resumeRun()` unblocking that same parked
    // promise), not via a second call to `run()`.
    let terminalState: WorkbenchProcessState;
    try {
      const summary = await pending.execute({
        signal: pending.controller.signal,
        report: (progress) => {
          process.progress = progress;
          this.emit();
        },
        suspend: (reason, suspendOptions) => this.suspend(pending, reason, suspendOptions),
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
      // Read from `pending`, not the `leasedMutation`/`renewTimer` this
      // function's own top set — a suspend/resume cycle may have replaced
      // both (or cleared the timer to `undefined`) since then, and this
      // `finally` must clean up whichever is current, not a stale value
      // closed over before the process last suspended.
      if (pending.renewTimer) clearInterval(pending.renewTimer);
      if (process.mutating) this.mutationLocked = false;
      if (pending.leasedMutation) await this.lease!.release();
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
