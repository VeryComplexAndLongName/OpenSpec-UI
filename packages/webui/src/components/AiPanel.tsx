// 5.2 A unified interface for running plan/implement/review regardless of
// the selected agent and active Transport.
// 5.3 Displays the event stream with the ability to cancel.
//
// Unlike the other components (Changes/Archive/Specs/Tasks), this one
// genuinely needs `Transport` directly — the execution command/event
// stream is inherently shaped as send+subscribe (see spec.md,
// "The AI panel uses a unified protocol regardless of the agent").

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  AGENT_REGISTRY,
  DEFAULT_AGENT_ID,
  normalizeStepAgent,
  type Command,
  type CommandKind,
  type Event,
  type HarnessStepAgents,
} from "@openspec-ui/core/browser";
import type { Transport } from "../transport/types.js";
import { AGENT_COMMANDS } from "../notify-run-completion.js";

const RUNNABLE_COMMANDS: readonly CommandKind[] = ["status", "list", "show", "validate", "plan", "implement", "review"];
const CHANGE_REQUIRED_COMMANDS: readonly CommandKind[] = ["status", "show", "validate", "plan", "implement", "review"];
// AGENT_COMMANDS (imported): commands that actually run through an agent —
// the agent picker only matters for these; `status`/`list`/`show`/
// `validate` bypass the runner entirely (see fetch-transport.ts/
// message-bridge-transport.ts).

interface ChecklistItem {
  checked: boolean;
  text: string;
}

interface StatusArtifactItem {
  id: string;
  status: string;
  outputPath: string;
}

interface StatusTaskItem {
  id: string;
  description: string;
  done: boolean;
}

interface StatusPayload {
  changeName: string;
  schemaName: string;
  progress?: {
    total: number;
    complete: number;
    remaining: number;
  };
  artifacts: StatusArtifactItem[];
  tasks?: StatusTaskItem[];
  state?: string;
  instruction?: string;
  isComplete?: boolean;
  nextSteps?: string[];
}

interface ListChangeItem {
  name: string;
  status?: string;
  completedTasks?: number;
  totalTasks?: number;
}

interface ListPayload {
  changes: ListChangeItem[];
}

interface ShowDeltaItem {
  spec?: string;
  operation?: string;
  description?: string;
}

interface ShowPayload {
  id: string;
  title?: string;
  deltaCount: number;
  deltas: ShowDeltaItem[];
}

interface ValidateTotals {
  items: number;
  passed: number;
  failed: number;
}

interface ValidateItem {
  id: string;
  type?: string;
  valid: boolean;
}

interface ValidatePayload {
  summary: { totals: ValidateTotals };
  items: ValidateItem[];
}

interface StepItem {
  title: string;
  details: string[];
}

interface RunInsights {
  steps: StepItem[];
  warnings: string[];
  highlights: string[];
  terminal: string | null;
}

type StructuredText =
  | { kind: "plain"; text: string }
  | { kind: "json"; value: unknown }
  | { kind: "status"; value: StatusPayload }
  | { kind: "list"; value: ListPayload }
  | { kind: "show"; value: ShowPayload }
  | { kind: "validate"; value: ValidatePayload }
  | { kind: "checklist"; items: ChecklistItem[] }
  | { kind: "keyValues"; pairs: Array<{ key: string; value: string }> }
  | { kind: "bullets"; items: string[] }
  | { kind: "steps"; items: StepItem[] };

function defaultRunId(): string {
  return crypto.randomUUID();
}

// Exported for HarnessChainPanel.tsx — a chain run's event stream (started/
// stdout/stderr/progress/checkpoint/stageCompleted/completed/failed/
// cancelled) is a superset of a single-stage run's, so it reuses this
// module's own event-collapsing/terminal-detection/body-rendering instead
// of a second, potentially-drifting copy (see agentic-harness-autonomy's
// design.md, "Chain-run view: a new component, not AiPanel extended in
// place").
export function isTerminal(event: Event): boolean {
  return event.kind === "completed" || event.kind === "failed" || event.kind === "cancelled";
}

function parseStepItems(text: string): StepItem[] | null {
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trimEnd())
    .filter((line) => line.trim().length > 0);

  if (lines.length === 0) return null;

  const items: StepItem[] = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index] ?? "";
    const stepMatch = line.trim().match(/^(?:●|\/)\s+(.+)$/);
    if (!stepMatch) {
      return null;
    }

    const item: StepItem = { title: (stepMatch[1] ?? "").trim(), details: [] };
    index += 1;

    while (index < lines.length) {
      const detailLine = (lines[index] ?? "").trim();
      if (/^(?:●|\/)\s+/.test(detailLine)) break;
      const detailMatch = detailLine.match(/^[│└├]\s*(.+)$/);
      if (!detailMatch) {
        return null;
      }
      const detail = (detailMatch[1] ?? "").trim();
      if (detail.length > 0) item.details.push(detail);
      index += 1;
    }

    items.push(item);
  }

  return items.length > 0 ? items : null;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isStatusPayload(value: unknown): value is StatusPayload {
  if (!isObjectRecord(value)) return false;
  if (typeof value.changeName !== "string" || typeof value.schemaName !== "string") return false;

  const progress = value.progress;
  if (progress !== undefined) {
    if (!isObjectRecord(progress)) return false;
    if (
      typeof progress.total !== "number" ||
      typeof progress.complete !== "number" ||
      typeof progress.remaining !== "number"
    ) {
      return false;
    }
  }

  if (!Array.isArray(value.artifacts)) return false;
  const artifactOk = value.artifacts.every((artifact) => {
    if (!isObjectRecord(artifact)) return false;
    return (
      typeof artifact.id === "string" &&
      typeof artifact.status === "string" &&
      typeof artifact.outputPath === "string"
    );
  });
  if (!artifactOk) return false;

  if (value.tasks !== undefined) {
    if (!Array.isArray(value.tasks)) return false;
    const taskOk = value.tasks.every((task) => {
      if (!isObjectRecord(task)) return false;
      return (
        typeof task.id === "string" &&
        typeof task.description === "string" &&
        typeof task.done === "boolean"
      );
    });
    if (!taskOk) return false;
  }

  return true;
}

function isListPayload(value: unknown): value is ListPayload {
  if (!isObjectRecord(value) || !Array.isArray(value.changes)) return false;
  return value.changes.every((item) => isObjectRecord(item) && typeof item.name === "string");
}

function isShowPayload(value: unknown): value is ShowPayload {
  if (!isObjectRecord(value)) return false;
  if (typeof value.id !== "string" || typeof value.deltaCount !== "number") return false;
  if (!Array.isArray(value.deltas)) return false;
  return value.deltas.every((item) => isObjectRecord(item));
}

function isValidatePayload(value: unknown): value is ValidatePayload {
  if (!isObjectRecord(value) || !Array.isArray(value.items)) return false;
  const summary = value.summary;
  if (!isObjectRecord(summary) || !isObjectRecord(summary.totals)) return false;
  const totals = summary.totals;
  if (
    typeof totals.items !== "number" ||
    typeof totals.passed !== "number" ||
    typeof totals.failed !== "number"
  ) {
    return false;
  }
  return value.items.every((item) => isObjectRecord(item) && typeof item.id === "string" && typeof item.valid === "boolean");
}

function extractStepItems(text: string): StepItem[] {
  const lines = text.split(/\r?\n/).map((line) => line.trimEnd());
  const items: StepItem[] = [];
  let current: StepItem | null = null;

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    const stepMatch = line.match(/^(?:●|\/)\s+(.+)$/);
    if (stepMatch) {
      current = { title: (stepMatch[1] ?? "").trim(), details: [] };
      items.push(current);
      continue;
    }

    if (current) {
      const detailMatch = line.match(/^[│└├]\s*(.+)$/);
      if (detailMatch) {
        const detail = (detailMatch[1] ?? "").trim();
        if (detail.length > 0) current.details.push(detail);
      }
    }
  }

  return items;
}

export function collapseStreamEvents(events: Event[]): Event[] {
  const collapsed: Event[] = [];

  for (const event of events) {
    const previous = collapsed[collapsed.length - 1];

    if (event.kind === "stdout" && previous?.kind === "stdout") {
      previous.chunk += event.chunk;
      continue;
    }

    if (event.kind === "stderr" && previous?.kind === "stderr") {
      previous.chunk += previous.chunk.endsWith("\n") ? event.chunk : `\n${event.chunk}`;
      continue;
    }

    if (event.kind === "progress" && previous?.kind === "progress") {
      previous.message += previous.message.endsWith("\n") ? event.message : `\n${event.message}`;
      continue;
    }

    collapsed.push({ ...event });
  }

  return collapsed;
}

function normalizeSentence(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function extractChangeNames(value: unknown): string[] | null {
  if (!isObjectRecord(value) || !Array.isArray(value.changes)) return null;

  const names = value.changes
    .map((item) => {
      if (!isObjectRecord(item) || typeof item.name !== "string") return null;
      return item.name;
    })
    .filter((name): name is string => name !== null);

  return names;
}

function parseChangeNamesFromStdout(raw: string): string[] | null {
  const text = raw.trim();
  if (!text.startsWith("{")) return null;
  try {
    const parsed = JSON.parse(text) as unknown;
    return extractChangeNames(parsed);
  } catch {
    return null;
  }
}

function resolveChangesRoot(changeDir: string): string {
  const normalized = changeDir.replace(/[\\/]+$/, "");
  if (/[\\/]changes$/i.test(normalized)) return normalized;
  const scopedMatch = normalized.match(/^(.*[\\/]changes)[\\/][^\\/]+$/i);
  return scopedMatch?.[1] ?? normalized;
}

function joinPath(base: string, segment: string): string {
  const separator = base.includes("\\") ? "\\" : "/";
  return `${base.replace(/[\\/]+$/, "")}${separator}${segment}`;
}

function isIgnorableWarning(text: string): boolean {
  const normalized = normalizeSentence(text).toLowerCase();
  return normalized === "debugger attached." || normalized === "waiting for the debugger to disconnect...";
}

function isTelemetryLine(text: string): boolean {
  const normalized = normalizeSentence(text);
  return (
    /^Changes\s+\+\d+\s+-\d+$/i.test(normalized) ||
    /^AI Credits\s+/i.test(normalized) ||
    /^Tokens\s+/i.test(normalized) ||
    /^Resume\s+/i.test(normalized)
  );
}

function collectRunInsights(events: Event[]): RunInsights {
  const steps: StepItem[] = [];
  const warnings: string[] = [];
  const highlights: string[] = [];
  let terminal: string | null = null;

  for (const event of events) {
    if (event.kind === "stdout") {
      const structured = parseStructuredText(event.chunk);
      if (structured.kind === "steps") {
        steps.push(...structured.items);
        continue;
      }
      const extractedSteps = extractStepItems(event.chunk);
      if (extractedSteps.length > 0) {
        steps.push(...extractedSteps);
      }
      if (structured.kind === "plain") {
        const normalized = normalizeSentence(structured.text);
        if (normalized.length > 0) highlights.push(normalized);
      }
      continue;
    }

    if (event.kind === "stderr") {
      const lines = event.chunk
        .split(/\r?\n/)
        .map((line) => normalizeSentence(line))
        .filter((line) => line.length > 0);
      for (const line of lines) {
        if (!isIgnorableWarning(line) && !isTelemetryLine(line)) {
          warnings.push(line);
        }
      }
      continue;
    }

    if (event.kind === "failed") {
      terminal = `failed: ${event.reason}`;
      continue;
    }

    if (event.kind === "cancelled") {
      terminal = "cancelled";
      continue;
    }

    if (event.kind === "completed") {
      terminal = event.summary ? `completed: ${event.summary}` : "completed";
    }
  }

  return {
    steps,
    warnings,
    highlights,
    terminal,
  };
}

function parseStructuredText(raw: string): StructuredText {
  const text = raw.trim();
  if (!text) return { kind: "plain", text: raw };

  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try {
      const parsed = JSON.parse(text) as unknown;
      if (isStatusPayload(parsed)) {
        return { kind: "status", value: parsed };
      }
      if (isListPayload(parsed)) {
        return { kind: "list", value: parsed };
      }
      if (isShowPayload(parsed)) {
        return { kind: "show", value: parsed };
      }
      if (isValidatePayload(parsed)) {
        return { kind: "validate", value: parsed };
      }
      return { kind: "json", value: parsed };
    } catch {
      // Fallback to plain text when JSON parsing fails.
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { kind: "plain", text: raw };
  }

  const parsedSteps = parseStepItems(text);
  if (parsedSteps && parsedSteps.length > 0) {
    return { kind: "steps", items: parsedSteps };
  }

  const checklistItems = lines
    .map((line) => line.match(/^[-*]\s+\[([ xX])\]\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => {
      const checkedMark = match[1] ?? " ";
      const itemText = match[2] ?? "";
      return { checked: checkedMark.toLowerCase() === "x", text: itemText.trim() };
    });
  if (checklistItems.length > 0 && checklistItems.length === lines.length) {
    return { kind: "checklist", items: checklistItems };
  }

  const keyValuePairs = lines
    .map((line) => line.match(/^([^:\n]+):\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => {
      const key = match[1] ?? "";
      const value = match[2] ?? "";
      return { key: key.trim(), value: value.trim() };
    });
  if (keyValuePairs.length >= 2 && keyValuePairs.length === lines.length) {
    return { kind: "keyValues", pairs: keyValuePairs };
  }

  const bulletItems = lines
    .map((line) => line.match(/^[-*]\s+(.+)$/))
    .filter((match): match is RegExpMatchArray => match !== null)
    .map((match) => (match[1] ?? "").trim());
  if (bulletItems.length >= 2 && bulletItems.length === lines.length) {
    return { kind: "bullets", items: bulletItems };
  }

  return { kind: "plain", text: raw };
}

function describeEvent(event: Event): string {
  switch (event.kind) {
    case "started":
      return `started (${event.command})`;
    case "stdout":
      return event.chunk;
    case "stderr":
      return event.chunk;
    case "progress":
      return event.message;
    case "completed":
      return event.summary ? `completed: ${event.summary}` : "completed";
    case "failed":
      return `failed: ${event.reason}`;
    case "cancelled":
      return "cancelled";
    case "stageCompleted":
      return `stage completed: ${event.stage} → ${event.nextStage}`;
    case "checkpoint":
      return `checkpoint: ${event.stage} → ${event.nextStage} (${event.nextAgentId})`;
    case "handedOff":
      return `handed off: ${event.stage} → VS Code chat`;
  }
}

function renderStructuredText(raw: string, index: number): ReactNode {
  const structured = parseStructuredText(raw);

  switch (structured.kind) {
    case "status": {
      // Progress is shown only when the CLI actually reported it. It used
      // to fall back to counting `artifacts` whose status is "done", which
      // reads "2/2" for a change with every task unchecked — the same
      // conflation that let chains archive unimplemented changes (see
      // openspec/changes/harness-chain-archive-gate).
      const progress = structured.value.progress;
      const progressPercent = progress && progress.total > 0
        ? Math.round((progress.complete / progress.total) * 100)
        : undefined;
      const doneTasks = structured.value.tasks?.filter((task) => task.done).length ?? 0;
      const totalTasks = structured.value.tasks?.length ?? 0;
      const nextStep = structured.value.nextSteps?.[0];

      return (
        <section className="openspec-status-card" data-testid={`event-${index}-status`}>
          <div className="openspec-status-card-head">
            <strong>{structured.value.changeName}</strong>
            <span>{structured.value.state ?? (structured.value.isComplete ? "complete" : "status")}</span>
          </div>
          <p className="openspec-status-card-meta">
            Schema: {structured.value.schemaName}
            {progress ? ` | Progress: ${progress.complete}/${progress.total}` : ""}
            {totalTasks > 0 ? ` | Tasks: ${doneTasks}/${totalTasks}` : ""}
          </p>
          {progressPercent === undefined ? null : (
            <div className="openspec-status-meter" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
              <div className="openspec-status-meter-fill" style={{ width: `${progressPercent}%` }} />
            </div>
          )}
          {structured.value.artifacts.length > 0 ? (
            <ul className="openspec-status-artifacts">
              {structured.value.artifacts.map((artifact) => (
                <li key={`${artifact.id}-${artifact.outputPath}`}>
                  <span className="openspec-status-artifact-id">{artifact.id}</span>
                  <span className={`openspec-status-pill is-${artifact.status.toLowerCase()}`}>{artifact.status}</span>
                </li>
              ))}
            </ul>
          ) : null}
          {structured.value.instruction ? <p className="openspec-status-card-instruction">{structured.value.instruction}</p> : null}
          {!structured.value.instruction && nextStep ? <p className="openspec-status-card-instruction">{nextStep}</p> : null}
        </section>
      );
    }
    case "list":
      return (
        <section className="openspec-data-card" data-testid={`event-${index}-list`}>
          <div className="openspec-data-card-head">
            <strong>OpenSpec Changes</strong>
            <span>{structured.value.changes.length}</span>
          </div>
          {structured.value.changes.length > 0 ? (
            <ul className="openspec-data-card-list">
              {structured.value.changes.slice(0, 12).map((change) => (
                <li key={change.name}>
                  <span className="openspec-data-card-primary">{change.name}</span>
                  <span className="openspec-data-card-secondary">
                    {typeof change.completedTasks === "number" && typeof change.totalTasks === "number"
                      ? `${change.completedTasks}/${change.totalTasks}`
                      : ""}
                    {change.status ? (typeof change.completedTasks === "number" ? ` | ${change.status}` : change.status) : ""}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="openspec-data-card-note">No changes found.</p>
          )}
        </section>
      );
    case "show":
      return (
        <section className="openspec-data-card" data-testid={`event-${index}-show`}>
          <div className="openspec-data-card-head">
            <strong>{structured.value.id}</strong>
            <span>{structured.value.deltaCount} deltas</span>
          </div>
          {structured.value.title ? <p className="openspec-data-card-note">{structured.value.title}</p> : null}
          {structured.value.deltas.length > 0 ? (
            <ul className="openspec-data-card-list">
              {structured.value.deltas.slice(0, 8).map((delta, deltaIndex) => (
                <li key={`${delta.spec ?? "spec"}-${deltaIndex}`}>
                  <span className="openspec-data-card-primary">{delta.operation ?? "update"} {delta.spec ?? "spec"}</span>
                  <span className="openspec-data-card-secondary">{delta.description ?? ""}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      );
    case "validate": {
      const failedItems = structured.value.items.filter((item) => !item.valid);
      return (
        <section className="openspec-data-card" data-testid={`event-${index}-validate`}>
          <div className="openspec-data-card-head">
            <strong>Validation</strong>
            <span>{structured.value.summary.totals.passed}/{structured.value.summary.totals.items} passed</span>
          </div>
          <p className="openspec-data-card-note">Failed: {structured.value.summary.totals.failed}</p>
          {failedItems.length > 0 ? (
            <ul className="openspec-data-card-list">
              {failedItems.slice(0, 8).map((item) => (
                <li key={item.id}>
                  <span className="openspec-data-card-primary">{item.id}</span>
                  <span className="openspec-data-card-secondary">{item.type ?? "item"}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      );
    }
    case "json":
      return (
        <pre className="openspec-event-json" data-testid={`event-${index}-json`}>
          {JSON.stringify(structured.value, null, 2)}
        </pre>
      );
    case "checklist":
      return (
        <ul className="openspec-event-checklist" data-testid={`event-${index}-checklist`}>
          {structured.items.map((item, itemIndex) => (
            <li key={itemIndex}>
              <span className={`openspec-checkmark ${item.checked ? "is-checked" : "is-open"}`}>
                {item.checked ? "done" : "todo"}
              </span>
              <span>{item.text}</span>
            </li>
          ))}
        </ul>
      );
    case "keyValues":
      return (
        <dl className="openspec-event-kv" data-testid={`event-${index}-kv`}>
          {structured.pairs.map((pair, pairIndex) => (
            <div key={pairIndex} className="openspec-event-kv-row">
              <dt>{pair.key}</dt>
              <dd>{pair.value}</dd>
            </div>
          ))}
        </dl>
      );
    case "bullets":
      return (
        <ul className="openspec-event-bullets" data-testid={`event-${index}-bullets`}>
          {structured.items.map((item, itemIndex) => (
            <li key={itemIndex}>{item}</li>
          ))}
        </ul>
      );
    case "steps":
      return (
        <ol className="openspec-event-steps" data-testid={`event-${index}-steps`}>
          {structured.items.map((item, itemIndex) => (
            <li key={itemIndex} className="openspec-event-step">
              <div className="openspec-event-step-title">{item.title}</div>
              {item.details.length > 0 ? (
                <ul className="openspec-event-step-details">
                  {item.details.map((detail, detailIndex) => (
                    <li key={detailIndex}>{detail}</li>
                  ))}
                </ul>
              ) : null}
            </li>
          ))}
        </ol>
      );
    case "plain":
      return <pre className="openspec-event-text">{structured.text}</pre>;
  }
}

export function renderEventBody(event: Event, index: number): ReactNode {
  switch (event.kind) {
    case "stdout":
      return renderStructuredText(event.chunk, index);
    case "stderr":
      return renderStructuredText(event.chunk, index);
    case "completed":
      return event.summary ? renderStructuredText(`completed: ${event.summary}`, index) : "completed";
    default:
      return describeEvent(event);
  }
}

/** Plain-text suffix, since a native `<select>`'s `<option>` cannot render
 * a rich badge (see design.md, "`<option>` label suffix instead of a rich
 * badge"). `undefined`/missing id means "unknown" — no suffix, not a
 * negative result — e.g. before detection has resolved for the first time. */
function agentOptionLabel(label: string, detected: boolean | undefined): string {
  if (detected === undefined) return label;
  return detected ? `${label} (detected)` : `${label} (not detected)`;
}

export interface AiPanelProps {
  transport: Transport;
  cwd: string;
  changeDir: string;
  promptContext?: string;
  generateRunId?: () => string;
  /** Best-effort presence signal per agent id — annotates the picker, never
   * filters or disables an option (see design.md, "Annotate, don't filter"). */
  detectedAgents?: Record<string, boolean>;
  /** Rendered as a "Refresh agents" button when supplied. Omitted in hosts
   * that already re-detect on their own (e.g. the VS Code message-bridge
   * host re-detects on every panel reveal). */
  onRefreshAgents?: () => void;
  /** Called once when an agent command (`plan`/`implement`/`review`) reaches
   * a terminal `completed`/`failed` event — never for `status`/`list`/
   * `show`/`validate` (near-instant, no "walked away" scenario) or for
   * `cancelled` (almost always the direct result of an action the caller
   * just took). Deliberately just a report, not a notification itself:
   * `AiPanel` stays transport- and host-neutral (see ADR 0001) — the host
   * (e.g. standalone-entry.tsx) decides whether to actually show a browser
   * `Notification`. Omitted entirely by hosts that already notify some
   * other way (the VS Code extension's message-bridge host notifies
   * natively from the extension side instead, see
   * packages/extension/src/run-notifications.ts). */
  onRunTerminal?: (commandKind: CommandKind, event: Event) => void;
  /** Agentic Harness `stepAgents` recommendation for the current
   * change, resolved by the host (see openspec/changes/agentic-harness/).
   * Pre-selects the picker for `plan`/`review`/`implement` (mapped to
   * `propose`/`review`/`apply`) — the user can still pick a different
   * agent before running; this never enforces the recommendation. May
   * include a model for the selected agent. */
  stepAgents?: HarnessStepAgents;
}

const COMMAND_KIND_TO_HARNESS_STAGE: Partial<Record<CommandKind, "propose" | "review" | "apply">> = {
  plan: "propose",
  review: "review",
  implement: "apply",
};

export function AiPanel({
  transport,
  cwd,
  changeDir,
  promptContext,
  generateRunId = defaultRunId,
  detectedAgents,
  onRefreshAgents,
  onRunTerminal,
  stepAgents,
}: AiPanelProps) {
  const [commandKind, setCommandKind] = useState<CommandKind>("list");
  const [agentId, setAgentId] = useState<string>(DEFAULT_AGENT_ID);
  const [availableChanges, setAvailableChanges] = useState<string[]>([]);
  const [selectedChange, setSelectedChange] = useState<string>("");
  const [selectionHint, setSelectionHint] = useState<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const activeCommandKindRef = useRef<CommandKind>("list");
  // The `cwd` the change list was already auto-loaded for, so opening the
  // panel populates the picker exactly once per working directory.
  const autoLoadedCwdRef = useRef<string | null>(null);
  const changesRoot = useMemo(() => resolveChangesRoot(changeDir), [changeDir]);

  // Agent Selection pre-fill (assisted-level Agentic Harness — see
  // openspec/changes/agentic-harness/design.md, "Agent Selection
  // pre-fill is advisory, never enforced"). Tracks, per command kind,
  // whether the user has manually picked an agent for it — a manual
  // pick is never overwritten by a later pre-fill for the same kind.
  const manuallySelectedCommandKinds = useRef<Set<CommandKind>>(new Set());
  useEffect(() => {
    if (manuallySelectedCommandKinds.current.has(commandKind)) return;
    const stage = COMMAND_KIND_TO_HARNESS_STAGE[commandKind];
    const configuredEntry = stage ? stepAgents?.[stage] : undefined;
    if (configuredEntry !== undefined) {
      const agentId = normalizeStepAgent(configuredEntry).agent;
      setAgentId(agentId);
    }
  }, [commandKind, stepAgents]);

  useEffect(() => {
    return transport.subscribe((event) => {
      if (event.runId === runIdRef.current) {
        if (event.kind === "stdout") {
          const names = parseChangeNamesFromStdout(event.chunk);
          if (names !== null) {
            setAvailableChanges(names);
            setSelectedChange((current) => {
              if (current.length > 0 && names.includes(current)) {
                return current;
              }
              return names[0] ?? "";
            });
            setSelectionHint(names.length > 0 ? null : "No OpenSpec changes found. Create a change first.");
          }
        }
        if (
          (event.kind === "completed" || event.kind === "failed")
          && AGENT_COMMANDS.includes(activeCommandKindRef.current)
        ) {
          onRunTerminal?.(activeCommandKindRef.current, event);
        }
        setEvents((prev) => [...prev, event]);
      }
    });
  }, [transport, onRunTerminal]);

  const collapsedEvents = useMemo(() => collapseStreamEvents(events), [events]);
  const runInsights = useMemo(() => collectRunInsights(collapsedEvents), [collapsedEvents]);

  const isRunning = runId !== null && !collapsedEvents.some(isTerminal);
  const requiresSelectedChange = CHANGE_REQUIRED_COMMANDS.includes(commandKind);
  const canRunCommand = !isRunning && (!requiresSelectedChange || selectedChange.length > 0);
  const latestEvent = collapsedEvents[collapsedEvents.length - 1];
  const statusLabel = isRunning
    ? "Loading..."
    : latestEvent?.kind === "failed"
      ? `Failed: ${latestEvent.reason}`
      : latestEvent?.kind === "completed"
        ? `Completed${latestEvent.summary ? `: ${latestEvent.summary}` : ""}`
        : "Idle";

  // Auto-load the change list once the working directory is known, so the
  // change picker is usable the moment the panel opens instead of being
  // gated behind a manual click. Declared *after* the transport.subscribe
  // effect above so the subscription exists before the command is sent —
  // otherwise the run's stdout would be missed and the picker would stay
  // empty. Only the read-only `list` command is ever auto-run.
  useEffect(() => {
    if (cwd === "") return;
    if (autoLoadedCwdRef.current === cwd) return;
    // A `list` fired into an in-flight run would reset events/runId and
    // clobber output the user is watching.
    if (isRunning) return;
    autoLoadedCwdRef.current = cwd;
    runCommand("list");
  }, [cwd, isRunning]);

  function runCommand(kind: CommandKind) {
    if (CHANGE_REQUIRED_COMMANDS.includes(kind) && selectedChange.length === 0) {
      setSelectionHint("Run list and choose a change before this command.");
      return;
    }

    const effectiveChangeDir = kind === "list" ? changesRoot : joinPath(changesRoot, selectedChange);

    const newRunId = generateRunId();
    runIdRef.current = newRunId;
    activeCommandKindRef.current = kind;
    setRunId(newRunId);
    setEvents([]);
    if (kind === "list") {
      setSelectionHint(null);
    }

    const stage = COMMAND_KIND_TO_HARNESS_STAGE[kind];
    const configuredEntry = stage ? stepAgents?.[stage] : undefined;
    const configuredAgent = configuredEntry ? normalizeStepAgent(configuredEntry).agent : undefined;
    const model = configuredEntry && configuredAgent === agentId ? normalizeStepAgent(configuredEntry).model : undefined;

    const command: Command = {
      kind,
      cwd,
      runId: newRunId,
      agentId: AGENT_COMMANDS.includes(kind) ? agentId : undefined,
      ...(model !== undefined && { model }),
      context: { changeDir: effectiveChangeDir, promptContext },
    };
    transport.send(command);
  }

  function handleRun() {
    runCommand(commandKind);
  }

  function handleLoadChanges() {
    runCommand("list");
  }

  return (
    <div className="openspec-ai-panel">
      <div className="openspec-ai-panel-controls">
        <button type="button" data-testid="load-changes-button" onClick={handleLoadChanges} disabled={isRunning}>
          Reload changes
        </button>
        <select
          aria-label="Select OpenSpec change"
          data-testid="change-picker"
          value={selectedChange}
          onChange={(e) => {
            setSelectedChange(e.target.value);
            setSelectionHint(null);
          }}
          disabled={availableChanges.length === 0 || isRunning}
        >
          <option value="">Select change</option>
          {availableChanges.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        <select
          aria-label="Select command"
          data-testid="command-picker"
          value={commandKind}
          onChange={(e) => setCommandKind(e.target.value as CommandKind)}
        >
          {RUNNABLE_COMMANDS.map((kind) => (
            <option key={kind} value={kind}>
              {kind}
            </option>
          ))}
        </select>
        <select
          aria-label="Select agent"
          data-testid="agent-picker"
          value={agentId}
          onChange={(e) => {
            manuallySelectedCommandKinds.current.add(commandKind);
            setAgentId(e.target.value);
          }}
          disabled={!AGENT_COMMANDS.includes(commandKind)}
        >
          {AGENT_REGISTRY.map((agent) => (
            <option key={agent.id} value={agent.id}>
              {agentOptionLabel(agent.label, detectedAgents?.[agent.id])}
            </option>
          ))}
        </select>
        {onRefreshAgents ? (
          <button type="button" data-testid="refresh-agents-button" onClick={onRefreshAgents}>
            Refresh agents
          </button>
        ) : null}
        <button type="button" data-testid="run-button" onClick={handleRun} disabled={!canRunCommand}>
          Run
        </button>
      </div>
      <p className="openspec-run-status" data-testid="run-status-label">
        {statusLabel}
      </p>
      {selectionHint ? <p className="openspec-shell-note">{selectionHint}</p> : null}
      {collapsedEvents.length > 0 ? (
        <section className="openspec-run-insights" data-testid="run-insights">
          <h3>Run analysis</h3>
          <p className="openspec-run-insights-meta">
            Steps: <strong>{runInsights.steps.length}</strong> | Warnings: <strong>{runInsights.warnings.length}</strong>
            {runInsights.terminal ? (
              <>
                {" "}
                | Result: <strong>{runInsights.terminal}</strong>
              </>
            ) : null}
          </p>
          {runInsights.steps.length > 0 ? (
            <ol className="openspec-run-insights-steps" data-testid="run-insights-steps">
              {runInsights.steps.map((step, index) => (
                <li key={`${step.title}-${index}`}>
                  <strong>{step.title}</strong>
                  {step.details.length > 0 ? ` — ${step.details.join("; ")}` : ""}
                </li>
              ))}
            </ol>
          ) : null}
          {runInsights.highlights.length > 0 ? (
            <p className="openspec-run-insights-highlight" data-testid="run-insights-highlight">
              {runInsights.highlights[runInsights.highlights.length - 1]}
            </p>
          ) : null}
          {runInsights.warnings.length > 0 ? (
            <ul className="openspec-run-insights-warnings" data-testid="run-insights-warnings">
              {runInsights.warnings.map((warning, index) => (
                <li key={`${warning}-${index}`}>{warning}</li>
              ))}
            </ul>
          ) : null}
        </section>
      ) : null}
      <ul className="openspec-ai-panel-events" data-testid="event-log">
        {collapsedEvents.map((event, index) => (
          <li key={index} data-testid={`event-${index}`} className={`openspec-event openspec-event--${event.kind}`}>
            {renderEventBody(event, index)}
          </li>
        ))}
      </ul>
    </div>
  );
}
