export type WorkbenchProcessState =
  | "queued"
  | "running"
  | "completed"
  | "failed"
  | "cancelled"
  | "rolled-back";

export interface WorkbenchProcess {
  id: string;
  operation: string;
  changeName?: string;
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
  private readonly changeLocks = new Set<string>();
  private readonly listeners = new Set<(processes: WorkbenchProcess[]) => void>();

  onDidChange(listener: (processes: WorkbenchProcess[]) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  list(): WorkbenchProcess[] {
    return [...this.processes.values()].map((process) => ({ ...process }));
  }

  markRolledBack(id: string, summary?: string): boolean {
    const process = this.processes.get(id);
    if (!process || process.state !== "completed") return false;
    process.state = "rolled-back";
    process.summary = summary ?? process.summary;
    this.emit();
    return true;
  }

  start(options: StartProcessOptions): WorkbenchProcessHandle {
    const id = options.id ?? crypto.randomUUID();
    if (this.processes.has(id)) throw new Error(`Workbench process already exists: ${id}`);

    const process: WorkbenchProcess = {
      id,
      operation: options.operation,
      changeName: options.changeName,
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
    return !process.mutating || !process.changeName || !this.changeLocks.has(process.changeName);
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
    if (process.mutating && process.changeName) this.changeLocks.add(process.changeName);
    process.state = "running";
    process.startedAt = new Date().toISOString();
    this.emit();
    try {
      const summary = await pending.execute({
        signal: pending.controller.signal,
        report: (progress) => {
          process.progress = progress;
          this.emit();
        },
      });
      if (pending.controller.signal.aborted) {
        this.finish(pending, "cancelled");
      } else {
        process.summary = summary ?? undefined;
        this.finish(pending, "completed");
      }
    } catch (error) {
      if (pending.controller.signal.aborted) {
        this.finish(pending, "cancelled");
      } else {
        process.error = error instanceof Error ? error.message : String(error);
        this.finish(pending, "failed");
      }
    } finally {
      if (process.mutating && process.changeName) this.changeLocks.delete(process.changeName);
      this.drain();
    }
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
