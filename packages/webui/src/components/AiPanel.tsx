// 5.2 Единый интерфейс запуска plan/implement/review независимо от
// выбранного агента и активного Transport.
// 5.3 Отображение потока событий с возможностью отмены (cancel).
//
// В отличие от остальных компонентов (Changes/Archive/Specs/Tasks), этот
// действительно нуждается в `Transport` напрямую — команда/поток событий
// исполнения по своей природе имеет форму send+subscribe (см. spec.md,
// "AI-панель использует единый протокол независимо от агента").

import { useEffect, useRef, useState } from "react";
import { AGENT_REGISTRY, type Command, type CommandKind, type Event } from "@openspec-ui/core";
import type { Transport } from "../transport/types.js";
import { AgentPicker } from "./AgentPicker.js";

const RUNNABLE_COMMANDS: readonly CommandKind[] = ["plan", "implement", "review"];

function defaultRunId(): string {
  return crypto.randomUUID();
}

function isTerminal(event: Event): boolean {
  return event.kind === "completed" || event.kind === "failed" || event.kind === "cancelled";
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
  const runIdRef = useRef<string | null>(null);

  useEffect(() => {
    return transport.subscribe((event) => {
      if (event.runId === runIdRef.current) {
        setEvents((prev) => [...prev, event]);
      }
    });
  }, [transport]);

  const isRunning = runId !== null && !events.some(isTerminal);

  function handleRun() {
    const newRunId = generateRunId();
    runIdRef.current = newRunId;
    setRunId(newRunId);
    setEvents([]);
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
            {describeEvent(event)}
          </li>
        ))}
      </ul>
    </div>
  );
}
