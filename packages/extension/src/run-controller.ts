// Shared run controller — a single active run at a time (the tool is
// single-user and local, see design.md non-goals). Used by both the
// Command Palette commands and the AI panel (Webview), so both paths see
// the same event stream and can cancel the same run.

import type { AgentRunner, Command, Event } from "@openspec-ui/core";
import { listChanges, showChange, statusChange, validateChange } from "@openspec-ui/core";

export type EventListener = (event: Event) => void;
export type Unsubscribe = () => void;

export class RunController {
  private activeCommand: Command | undefined;
  private activeRunner: AgentRunner | undefined;
  private readonly listeners = new Set<EventListener>();

  onEvent(listener: EventListener): Unsubscribe {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  get isRunning(): boolean {
    return this.activeCommand !== undefined;
  }

  private emit(event: Event): void {
    for (const listener of this.listeners) listener(event);
  }

  private nowIso(): string {
    return new Date().toISOString();
  }

  private resolveChangeName(command: Command): string {
    const segments = command.context.changeDir.split(/[\\/]+/).filter((segment) => segment.length > 0);
    return segments[segments.length - 1] ?? "";
  }

  private async runDirectOpenSpecCommand(command: Command): Promise<void> {
    this.emit({
      kind: "started",
      runId: command.runId,
      timestamp: this.nowIso(),
      command: command.kind,
      cwd: command.cwd,
    });

    try {
      const changeName = this.resolveChangeName(command);
      let result: unknown;
      let summary = "completed";

      switch (command.kind) {
        case "status": {
          if (!changeName) {
            throw new Error("failed to resolve change name from command.context.changeDir");
          }
          const status = await statusChange(changeName, { cwd: command.cwd });
          result = status;
          const progress = status.progress;
          if (progress && typeof progress.complete === "number" && typeof progress.total === "number") {
            summary = `${progress.complete}/${progress.total} tasks complete`;
          } else {
            summary = `status loaded for ${status.changeName}`;
          }
          break;
        }
        case "list": {
          const list = await listChanges({ cwd: command.cwd });
          result = list;
          summary = `${list.changes.length} changes listed`;
          break;
        }
        case "show": {
          if (!changeName) {
            throw new Error("failed to resolve change name from command.context.changeDir");
          }
          const shown = await showChange(changeName, { cwd: command.cwd });
          result = shown;
          summary = `${shown.deltaCount} deltas in ${shown.id}`;
          break;
        }
        case "validate": {
          if (!changeName) {
            throw new Error("failed to resolve change name from command.context.changeDir");
          }
          const validation = await validateChange(changeName, { cwd: command.cwd });
          result = validation;
          summary = `${validation.summary.totals.passed}/${validation.summary.totals.items} passed`;
          break;
        }
        default:
          throw new Error(`unsupported direct OpenSpec command: ${command.kind}`);
      }

      this.emit({
        kind: "stdout",
        runId: command.runId,
        timestamp: this.nowIso(),
        chunk: JSON.stringify(result),
      });
      this.emit({
        kind: "completed",
        runId: command.runId,
        timestamp: this.nowIso(),
        summary,
      });
    } catch (error) {
      this.emit({
        kind: "failed",
        runId: command.runId,
        timestamp: this.nowIso(),
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }

  async run(runner: AgentRunner | undefined, command: Command): Promise<void> {
    this.activeCommand = command;
    this.activeRunner = runner;
    try {
      if (command.kind === "status" || command.kind === "list" || command.kind === "show" || command.kind === "validate") {
        await this.runDirectOpenSpecCommand(command);
        return;
      }

      if (!runner) {
        this.emit({
          kind: "failed",
          runId: command.runId,
          timestamp: this.nowIso(),
          reason: "AI agent execution is disabled in direct OpenSpec mode.",
        });
        return;
      }

      for await (const event of runner.run(command)) {
        this.emit(event);
      }
    } finally {
      if (this.activeCommand?.runId === command.runId) {
        this.activeCommand = undefined;
        this.activeRunner = undefined;
      }
    }
  }

  /** Sends `cancel` for the currently active run, if any.
   * Returns `false` if there is nothing to cancel. */
  cancel(): boolean {
    if (!this.activeCommand || !this.activeRunner) return false;
    const cancelCommand: Command = { ...this.activeCommand, kind: "cancel" };
    void this.run(this.activeRunner, cancelCommand);
    return true;
  }
}
