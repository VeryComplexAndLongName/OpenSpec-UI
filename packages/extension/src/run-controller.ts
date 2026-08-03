// Общий контроллер запуска — один активный run за раз (инструмент
// однопользовательский, локальный, см. design.md non-goals). Используется и
// командами Command Palette, и AI-панелью (Webview), чтобы оба пути видели
// один и тот же поток событий и могли отменить один и тот же запуск.

import type { AgentRunner, Command, Event } from "@openspec-ui/core";

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

  async run(runner: AgentRunner, command: Command): Promise<void> {
    this.activeCommand = command;
    this.activeRunner = runner;
    try {
      for await (const event of runner.run(command)) {
        for (const listener of this.listeners) listener(event);
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
