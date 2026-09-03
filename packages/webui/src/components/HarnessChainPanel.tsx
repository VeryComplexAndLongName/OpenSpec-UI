// Minimal chain-run view for the Agentic Harness's `semi-autonomous`/
// `autonomous` levels (ADR 0012) — starts a `"chain"` command, renders a
// `checkpoint` event as an explicit confirm/cancel choice, and
// `stageCompleted` as ongoing progress via `AiPanel.tsx`'s own event
// rendering (reused, not duplicated — see agentic-harness-autonomy's
// design.md, "Chain-run view: a new component, not AiPanel extended in
// place"). Intentionally has no menu entry or tree integration of its
// own — `agentic-harness-run-menu` wires this component into both
// delivery targets' UX.

import { useEffect, useMemo, useRef, useState } from "react";
import type { Command, CheckpointEvent, Event, HarnessBudget } from "@openspec-ui/core/browser";
import type { Transport } from "../transport/types.js";
import { collapseStreamEvents, isCancelling, isTerminal, renderEventBody } from "./AiPanel.js";
import { UsageSummaryView } from "./UsageSummaryView.js";

export interface HarnessChainPanelProps {
  transport: Transport;
  cwd: string;
  changeDir: string;
  generateRunId?: () => string;
  /** The resolved harness `budget`, when the host resolved one. Passed
   * through to the usage summary purely so the ceiling is legible beside
   * the recorded total — nothing here enforces it (see
   * UsageSummaryView.tsx's header). */
  budget?: HarnessBudget;
}

function defaultRunId(): string {
  return crypto.randomUUID();
}

function isCheckpointEvent(event: Event | undefined): event is CheckpointEvent {
  return event?.kind === "checkpoint";
}

export function HarnessChainPanel({ transport, cwd, changeDir, generateRunId = defaultRunId, budget }: HarnessChainPanelProps) {
  const [runId, setRunId] = useState<string | null>(null);
  const runIdRef = useRef<string | null>(null);
  const [events, setEvents] = useState<Event[]>([]);

  useEffect(() => {
    return transport.subscribe((event) => {
      if (event.runId !== runIdRef.current) return;
      setEvents((prev) => [...prev, event]);
    });
  }, [transport]);

  const collapsedEvents = useMemo(() => collapseStreamEvents(events), [events]);
  const latestEvent = collapsedEvents[collapsedEvents.length - 1];
  const isRunning = runId !== null && !collapsedEvents.some(isTerminal);
  const pendingCheckpoint = isCheckpointEvent(latestEvent) ? latestEvent : undefined;

  function sendOnCurrentRun(kind: Command["kind"]) {
    const activeRunId = runIdRef.current;
    if (!activeRunId) return;
    transport.send({ kind, cwd, runId: activeRunId, context: { changeDir } });
  }

  function startChain() {
    const newRunId = generateRunId();
    runIdRef.current = newRunId;
    setRunId(newRunId);
    setEvents([]);
    transport.send({ kind: "chain", cwd, runId: newRunId, context: { changeDir } });
  }

  const statusLabel = pendingCheckpoint
    ? "Paused at checkpoint"
    : isRunning && isCancelling(collapsedEvents)
      // Not "Cancelled": the request has been made and the process has
      // not gone yet. Saying it ended while its output is still arriving
      // is the original complaint this wording answers.
      ? "Cancelling..."
      : isRunning
      ? "Running..."
      : latestEvent?.kind === "failed"
        ? `Failed: ${latestEvent.reason}`
        : latestEvent?.kind === "completed"
          ? `Completed${latestEvent.summary ? `: ${latestEvent.summary}` : ""}`
          : latestEvent?.kind === "cancelled"
            ? "Cancelled"
            : "Idle";

  return (
    <div className="openspec-harness-chain-panel">
      <div className="openspec-ai-panel-controls">
        <button type="button" data-testid="start-chain-button" onClick={startChain} disabled={isRunning}>
          Run with Agentic Harness
        </button>
        {isRunning && !pendingCheckpoint ? (
          <button type="button" data-testid="cancel-chain-button" onClick={() => sendOnCurrentRun("cancel")}>
            Cancel
          </button>
        ) : null}
      </div>
      <p className="openspec-run-status" data-testid="chain-status-label">
        {statusLabel}
      </p>
      {pendingCheckpoint ? (
        <div className="openspec-shell-note" data-testid="checkpoint-confirmation">
          <p>
            Continue to <strong>{pendingCheckpoint.nextStage}</strong>
            {pendingCheckpoint.nextAgentId ? ` with ${pendingCheckpoint.nextAgentId}` : ""}?
          </p>
          <div className="openspec-ai-panel-controls">
            <button
              type="button"
              data-testid="confirm-checkpoint-button"
              onClick={() => sendOnCurrentRun("confirmCheckpoint")}
            >
              Continue
            </button>
            <button type="button" data-testid="cancel-checkpoint-button" onClick={() => sendOnCurrentRun("cancel")}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}
      <UsageSummaryView events={collapsedEvents} budget={budget} />
      <ul className="openspec-ai-panel-events" data-testid="chain-event-log">
        {collapsedEvents.map((event, index) => (
          <li key={index} data-testid={`chain-event-${index}`} className={`openspec-event openspec-event--${event.kind}`}>
            {renderEventBody(event, index)}
          </li>
        ))}
      </ul>
    </div>
  );
}
