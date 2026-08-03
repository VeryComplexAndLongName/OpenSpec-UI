// 5.2 Единый интерфейс запуска plan/implement/review независимо от
// выбранного агента и активного Transport.
// 5.3 Отображение потока событий с возможностью отмены (cancel).
//
// В отличие от остальных компонентов (Changes/Archive/Specs/Tasks), этот
// действительно нуждается в `Transport` напрямую — команда/поток событий
// исполнения по своей природе имеет форму send+subscribe (см. spec.md,
// "AI-панель использует единый протокол независимо от агента").

import { useEffect, useRef, useState, type ReactNode } from "react";
import { AGENT_REGISTRY, type Command, type CommandKind, type Event } from "@openspec-ui/core/browser";
import type { Transport } from "../transport/types.js";
import { AgentPicker } from "./AgentPicker.js";

const RUNNABLE_COMMANDS: readonly CommandKind[] = ["plan", "implement", "review", "status"];

interface ChecklistItem {
  checked: boolean;
  text: string;
}

type StructuredText =
  | { kind: "plain"; text: string }
  | { kind: "json"; value: unknown }
  | { kind: "checklist"; items: ChecklistItem[] }
  | { kind: "keyValues"; pairs: Array<{ key: string; value: string }> }
  | { kind: "bullets"; items: string[] };

function defaultRunId(): string {
  return crypto.randomUUID();
}

function isTerminal(event: Event): boolean {
  return event.kind === "completed" || event.kind === "failed" || event.kind === "cancelled";
}

function parseStructuredText(raw: string): StructuredText {
  const text = raw.trim();
  if (!text) return { kind: "plain", text: raw };

  if ((text.startsWith("{") && text.endsWith("}")) || (text.startsWith("[") && text.endsWith("]"))) {
    try {
      return { kind: "json", value: JSON.parse(text) as unknown };
    } catch {
      // Fallback to plain text when JSON parsing fails.
    }
  }

  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line.length > 0);
  if (lines.length === 0) {
    return { kind: "plain", text: raw };
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
  const policyError = detectPolicyError(event);
  if (policyError) {
    return `failed: ${policyError}`;
  }
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

function detectPolicyError(event: Event): string | undefined {
  if (event.kind !== "failed") return undefined;
  const reason = event.reason.toLowerCase();
  const policyIndicators = [
    "access denied by policy settings",
    "policy setting may be preventing access",
    "your copilot cli policy setting may be preventing access",
    "required policies have not been enabled",
  ];
  if (policyIndicators.some((indicator) => reason.includes(indicator))) {
    return "Copilot CLI is blocked by policy settings for this account. Open GitHub settings, enable Copilot CLI access, then try again.";
  }
  return undefined;
}

export interface AiPanelProps {
  transport: Transport;
  cwd: string;
  changeDir: string;
  promptContext?: string;
  generateRunId?: () => string;
}

export function AiPanel({ transport, cwd, changeDir, promptContext, generateRunId = defaultRunId }: AiPanelProps) {
  const [agentId, setAgentId] = useState<string>(AGENT_REGISTRY[0]?.id ?? "");
  const [commandKind, setCommandKind] = useState<CommandKind>("plan");
  const [events, setEvents] = useState<Event[]>([]);
  const [runId, setRunId] = useState<string | null>(null);
  const [statusBanner, setStatusBanner] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    return transport.subscribe((event) => {
      if (event.runId === runIdRef.current) {
        setEvents((prev) => [...prev, event]);
        const policyError = detectPolicyError(event);
        if (policyError) setStatusBanner(policyError);
        if (event.kind === "completed" || event.kind === "cancelled") {
          setStatusBanner(null);
        }
      }
    });
  }, [transport]);

  const isRunning = runId !== null && !events.some(isTerminal);

  function handleRun() {
    const newRunId = generateRunId();
    runIdRef.current = newRunId;
    setRunId(newRunId);
    setEvents([]);
    setStatusBanner(null);
    const command: Command = {
      kind: commandKind,
      cwd,
      runId: newRunId,
      agentId,
      context: { changeDir, promptContext },
    };
    transport.send(command);
  }

  function handleCancel() {
    if (!runId) return;
    transport.send({ kind: "cancel", cwd, runId, agentId, context: { changeDir } });
  }

  return (
    <div className="openspec-ai-panel">
      {statusBanner ? (
        <div className="openspec-ai-panel-banner" role="alert" data-testid="status-banner">
          <strong>Policy issue:</strong> {statusBanner}{" "}
          <a href="https://github.com/settings/copilot" target="_blank" rel="noreferrer">
            Open Copilot settings
          </a>
        </div>
      ) : null}
      <div className="openspec-ai-panel-controls">
        <AgentPicker value={agentId} onChange={setAgentId} />
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
        <button type="button" data-testid="cancel-button" onClick={handleCancel} disabled={!isRunning}>
          Cancel
        </button>
      </div>
      <ul className="openspec-ai-panel-events" data-testid="event-log">
        {events.map((event, index) => (
          <li key={index} data-testid={`event-${index}`} className={`openspec-event openspec-event--${event.kind}`}>
            {renderEventBody(event, index)}
          </li>
        ))}
      </ul>
    </div>
  );
}
