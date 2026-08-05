// Общий контроллер запуска — один активный run за раз (инструмент
// однопользовательский, локальный, см. design.md non-goals). Используется и
// командами Command Palette, и AI-панелью (Webview), чтобы оба пути видели
// один и тот же поток событий и могли отменить один и тот же запуск.

import type { AgentRunner, Command, Event } from "@openspec-ui/core";
import { statusChange } from "@openspec-ui/core";

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

  private async runStatusFromJson(command: Command): Promise<void> {
    this.emit({
      kind: "started",
      runId: command.runId,
      timestamp: this.nowIso(),
      command: "status",
      cwd: command.cwd,
    });

    const segments = command.context.changeDir.split(/[\\/]+/).filter((segment) => segment.length > 0);
    const changeName = segments[segments.length - 1] ?? "";
    if (!changeName) {
      this.emit({
        kind: "failed",
        runId: command.runId,
        timestamp: this.nowIso(),
        reason: "failed to resolve change name from command.context.changeDir",
      });
      return;
    }

    try {
      const result = await statusChange(changeName, { cwd: command.cwd });
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
        summary: `${result.progress.complete}/${result.progress.total} tasks complete`,
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
      if (command.kind === "status") {
        await this.runStatusFromJson(command);
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

  /** Отправляет `cancel` для текущего активного запуска, если он есть.
   * Возвращает `false`, если отменять нечего. */
  cancel(): boolean {
    if (!this.activeCommand || !this.activeRunner) return false;
    const cancelCommand: Command = { ...this.activeCommand, kind: "cancel" };
    void this.run(this.activeRunner, cancelCommand);
    return true;
  }
}
