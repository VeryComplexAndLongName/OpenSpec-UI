// Общий помощник для CLI-адаптеров, основанных на дочернем процессе (все,
// кроме локальной LLM — та работает через HTTP, см. local-llm.ts).
//
// Консервативный парсинг: вывод агента передаётся построчно как есть в
// событие `stdout`/`stderr`, без попытки угадать структурированный формат.
// Если версия CLI поменяет формат вывода, поток событий не ломается — просто
// не даёт `progress`, только `stdout` (см. spec.md, "Непредвиденный формат
// вывода агента").

import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import type { CommandKind, Event } from "../protocol.js";

function nowIso(): string {
  return new Date().toISOString();
}

export interface SpawnAndStreamOptions {
  executable: string;
  args: string[];
  cwd: string;
  runId: string;
  commandKind: CommandKind;
  /** Передаётся в stdin процесса (например, промпт для CLI, читающих его со stdin). */
  stdin?: string;
}

/** Инструкция, зависящая ТОЛЬКО от `command.kind` (доверенное значение,
 * заданное вызывающей стороной, а не содержимым change-файлов) — безопасно
 * ставить перед промптом, полученным из prepareAgentContext. */
export function commandInstruction(kind: CommandKind): string {
  switch (kind) {
    case "plan":
      return "Составь план реализации для описанного ниже change'а, не изменяя код.";
    case "implement":
      return "Реализуй задачи из tasks.md для описанного ниже change'а.";
    case "review":
      return "Проверь текущую реализацию описанного ниже change'а на соответствие спецификации.";
    case "status":
      return "Опиши текущий статус реализации описанного ниже change'а.";
    case "cancel":
      return "Останови текущее выполнение для описанного ниже change'а.";
  }
}

export async function* spawnAndStream(options: SpawnAndStreamOptions): AsyncGenerator<Event> {
  const { executable, args, cwd, runId, commandKind, stdin } = options;

  let child: ChildProcessWithoutNullStreams;
  try {
    child = spawn(executable, args, { cwd, stdio: ["pipe", "pipe", "pipe"] });
  } catch (err) {
    yield {
      kind: "failed",
      runId,
      timestamp: nowIso(),
      reason: err instanceof Error ? err.message : String(err),
    };
    return;
  }

  if (stdin !== undefined) {
    child.stdin.write(stdin);
  }
  child.stdin.end();

  type QueueItem = Event | { kind: "__exit__"; code: number | null } | { kind: "__error__"; error: Error };
  const queue: QueueItem[] = [];
  let resolveWake: (() => void) | null = null;
  const wake = () => {
    resolveWake?.();
    resolveWake = null;
  };
  const push = (item: QueueItem) => {
    queue.push(item);
    wake();
  };

  // Слушатели вешаются синхронно, ДО первого `yield` — это гарантирует, что
  // ни одно событие процесса не будет потеряно между спавном и началом
  // потребления очереди (весь код до первого await/yield выполняется в
  // одном синхронном тике, раньше, чем event loop успеет доставить данные
  // от дочернего процесса).
  child.stdout.on("data", (data: Buffer) => {
    push({ kind: "stdout", runId, timestamp: nowIso(), chunk: data.toString("utf8") });
  });
  child.stderr.on("data", (data: Buffer) => {
    push({ kind: "stderr", runId, timestamp: nowIso(), chunk: data.toString("utf8") });
  });
  child.on("error", (error) => {
    push({ kind: "__error__", error });
  });
  child.on("close", (code) => {
    push({ kind: "__exit__", code });
  });

  yield { kind: "started", runId, timestamp: nowIso(), command: commandKind, cwd };

  let done = false;
  while (!done) {
    if (queue.length === 0) {
      await new Promise<void>((resolve) => {
        resolveWake = resolve;
      });
      continue;
    }
    const item = queue.shift() as QueueItem;
    if (item.kind === "__exit__") {
      done = true;
      if (item.code === 0) {
        yield { kind: "completed", runId, timestamp: nowIso() };
      } else {
        yield {
          kind: "failed",
          runId,
          timestamp: nowIso(),
          reason: `${executable} завершился с кодом ${item.code ?? "unknown"}`,
        };
      }
    } else if (item.kind === "__error__") {
      done = true;
      yield { kind: "failed", runId, timestamp: nowIso(), reason: item.error.message };
    } else {
      yield item;
    }
  }
}
