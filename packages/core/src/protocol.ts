// Унифицированный протокол выполнения: команды и поток событий.
//
// Единственное место, где определены эти типы (см.
// docs/adr/0001-shared-core-two-delivery-targets.md, п.3). Потребители
// (`server`, `extension`) сериализуют эти же значения под свой транспорт
// (REST/WS, message bridge) и не должны переопределять свои варианты.

export type CommandKind =
  | "plan"
  | "implement"
  | "review"
  | "status"
  | "list"
  | "show"
  | "validate"
  | "cancel";

export interface CommandContext {
  /** Абсолютный путь к change'у OpenSpec, к которому относится команда. */
  changeDir: string;
  /** Произвольные данные из change'а (proposal/design/tasks), передаваемые
   * агенту как контент промпта. Это ДАННЫЕ — см. security.ts prepareAgentContext:
   * ничто отсюда не может повлиять на allowlist/cwd/выбор команды. */
  promptContext?: string;
}

export interface Command {
  kind: CommandKind;
  /** Рабочая директория, в которой должен быть запущен агент. */
  cwd: string;
  context: CommandContext;
  /** Идентификатор запуска, генерируется вызывающей стороной для сопоставления
   * событий с запросом (нужен для cancel). */
  runId: string;
  /** Какой зарегистрированный агент (`AgentAdapter.name`/`AgentDescriptor.id`
   * из agents/registry.ts) должен выполнить команду. Опционально — хост
   * может использовать единственный сконфигурированный агент по умолчанию,
   * если UI-слой выбор агента не показывает. */
  agentId?: string;
}

export type EventKind =
  | "started"
  | "stdout"
  | "stderr"
  | "progress"
  | "completed"
  | "failed"
  | "cancelled";

interface BaseEvent {
  runId: string;
  /** ISO 8601 timestamp. */
  timestamp: string;
}

export interface StartedEvent extends BaseEvent {
  kind: "started";
  command: CommandKind;
  cwd: string;
}

export interface StdoutEvent extends BaseEvent {
  kind: "stdout";
  chunk: string;
}

export interface StderrEvent extends BaseEvent {
  kind: "stderr";
  chunk: string;
}

export interface ProgressEvent extends BaseEvent {
  kind: "progress";
  /** Произвольное человекочитаемое сообщение о прогрессе (не обязательно
   * числовое — конкретные агенты сообщают о прогрессе по-разному). */
  message: string;
}

export interface CompletedEvent extends BaseEvent {
  kind: "completed";
  /** Итоговый diff/изменения, если применимо (best-effort, может быть пустым). */
  summary?: string;
}

export interface FailedEvent extends BaseEvent {
  kind: "failed";
  reason: string;
}

export interface CancelledEvent extends BaseEvent {
  kind: "cancelled";
}

export type Event =
  | StartedEvent
  | StdoutEvent
  | StderrEvent
  | ProgressEvent
  | CompletedEvent
  | FailedEvent
  | CancelledEvent;

/** Type guard-помощник: сериализация Event — это просто JSON, но проверяем,
 * что `kind` — один из известных вариантов, при десериализации из внешнего
 * транспорта (REST/WS/message bridge), где данные приходят как `unknown`. */
export function isEvent(value: unknown): value is Event {
  if (typeof value !== "object" || value === null) return false;
  const v = value as Record<string, unknown>;
  if (typeof v.runId !== "string" || typeof v.timestamp !== "string") return false;
  switch (v.kind) {
    case "started":
      return typeof v.command === "string" && typeof v.cwd === "string";
    case "stdout":
    case "stderr":
      return typeof v.chunk === "string";
    case "progress":
      return typeof v.message === "string";
    case "completed":
      return v.summary === undefined || typeof v.summary === "string";
    case "failed":
      return typeof v.reason === "string";
    case "cancelled":
      return true;
    default:
      return false;
  }
}

export function serializeEvent(event: Event): string {
  return JSON.stringify(event);
}

export function deserializeEvent(raw: string): Event {
  const parsed: unknown = JSON.parse(raw);
  if (!isEvent(parsed)) {
    throw new Error(`Не удалось десериализовать Event: неизвестный формат (${raw})`);
  }
  return parsed;
}
