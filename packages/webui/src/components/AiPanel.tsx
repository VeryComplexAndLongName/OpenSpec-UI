// 5.2 Единый интерфейс запуска plan/implement/review независимо от
// выбранного агента и активного Transport.
// 5.3 Отображение потока событий с возможностью отмены (cancel).
//
// В отличие от остальных компонентов (Changes/Archive/Specs/Tasks), этот
// действительно нуждается в `Transport` напрямую — команда/поток событий
// исполнения по своей природе имеет форму send+subscribe (см. spec.md,
// "AI-панель использует единый протокол независимо от агента").

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { type Command, type CommandKind, type Event } from "@openspec-ui/core/browser";
import type { Transport } from "../transport/types.js";

const RUNNABLE_COMMANDS: readonly CommandKind[] = ["status"];

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
  progress: {
    total: number;
    complete: number;
    remaining: number;
  };
  artifacts: StatusArtifactItem[];
  tasks?: StatusTaskItem[];
  state?: string;
  instruction?: string;
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
  | { kind: "checklist"; items: ChecklistItem[] }
  | { kind: "keyValues"; pairs: Array<{ key: string; value: string }> }
  | { kind: "bullets"; items: string[] }
  | { kind: "steps"; items: StepItem[] };

function defaultRunId(): string {
  return crypto.randomUUID();
}

function isTerminal(event: Event): boolean {
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
  if (!isObjectRecord(progress)) return false;
  if (
    typeof progress.total !== "number" ||
    typeof progress.complete !== "number" ||
    typeof progress.remaining !== "number"
  ) {
    return false;
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

function collapseStreamEvents(events: Event[]): Event[] {
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
  }
}

function renderStructuredText(raw: string, index: number): ReactNode {
  const structured = parseStructuredText(raw);

  switch (structured.kind) {
    case "status": {
      const progressTotal = Math.max(structured.value.progress.total, 1);
      const progressPercent = Math.round((structured.value.progress.complete / progressTotal) * 100);
      const doneTasks = structured.value.tasks?.filter((task) => task.done).length ?? 0;
      const totalTasks = structured.value.tasks?.length ?? 0;

      return (
        <section className="openspec-status-card" data-testid={`event-${index}-status`}>
          <div className="openspec-status-card-head">
            <strong>{structured.value.changeName}</strong>
            <span>{structured.value.state ?? "status"}</span>
          </div>
          <p className="openspec-status-card-meta">
            Schema: {structured.value.schemaName} | Progress: {structured.value.progress.complete}/{structured.value.progress.total}
            {totalTasks > 0 ? ` | Tasks: ${doneTasks}/${totalTasks}` : ""}
          </p>
          <div className="openspec-status-meter" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
            <div className="openspec-status-meter-fill" style={{ width: `${progressPercent}%` }} />
          </div>
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

function renderEventBody(event: Event, index: number): ReactNode {
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

export interface AiPanelProps {
  transport: Transport;
  cwd: string;
  changeDir: string;
  promptContext?: string;
  generateRunId?: () => string;
}

export function AiPanel({ transport, cwd, changeDir, promptContext, generateRunId = defaultRunId }: AiPanelProps) {
  const [commandKind, setCommandKind] = useState<CommandKind>("status");
  const [events, setEvents] = useState<Event[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    return transport.subscribe((event) => {
      if (event.runId === runIdRef.current) {
        setEvents((prev) => [...prev, event]);
      }
    });
  }, [transport]);

  const collapsedEvents = useMemo(() => collapseStreamEvents(events), [events]);
  const runInsights = useMemo(() => collectRunInsights(collapsedEvents), [collapsedEvents]);

  const isRunning = runId !== null && !collapsedEvents.some(isTerminal);

  function handleRun() {
    const newRunId = generateRunId();
    runIdRef.current = newRunId;
    setRunId(newRunId);
    setEvents([]);
    const command: Command = {
      kind: commandKind,
      cwd,
      runId: newRunId,
      context: { changeDir, promptContext },
    };
    transport.send(command);
  }

  return (
    <div className="openspec-ai-panel">
      <div className="openspec-ai-panel-controls">
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
        <button type="button" data-testid="run-button" onClick={handleRun} disabled={isRunning}>
          Run
        </button>
      </div>
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
