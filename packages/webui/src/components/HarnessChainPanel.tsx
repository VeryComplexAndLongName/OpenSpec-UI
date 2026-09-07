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
import {
  collapseStreamEvents,
  findPendingPermissionRequest,
  isCancelling,
  isTerminal,
  PermissionRequestPrompt,
  renderEventBody,
} from "./AiPanel.js";
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
  // Tracks which permissionRequest ids this panel has already answered —
  // same reasoning as `AiPanel`'s own `resolvedPermissionRequestIds`
  // (design.md, "The panel shares AiPanel's permission rendering, not its
  // send"): there is no server-emitted "resolved" event to key off of.
  const [resolvedPermissionRequestIds, setResolvedPermissionRequestIds] = useState<Set<string>>(new Set());

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
  const pendingPermissionRequest = useMemo(
    () => findPendingPermissionRequest(collapsedEvents, resolvedPermissionRequestIds),
    [collapsedEvents, resolvedPermissionRequestIds],
  );

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
    setResolvedPermissionRequestIds(new Set());
    transport.send({ kind: "chain", cwd, runId: newRunId, context: { changeDir } });
  }

  // Answers with the event's own `runId`/`requestId`, never
  // `runIdRef.current` — the stage that raised the request is what the
  // adapter's pending map is keyed on (design.md's task 3.2). Today a
  // stage runs under the chain's own runId, so the two happen to be equal,
  // but the event is still the source of truth this reads from.
  function handleResolvePermission(request: Extract<Event, { kind: "permissionRequest" }>, outcome: "allow" | "deny") {
    transport.send({
      kind: "resolvePermission",
      cwd,
      runId: request.runId,
      context: { changeDir },
      permissionRequestId: request.requestId,
      permissionOutcome: outcome,
    });
    setResolvedPermissionRequestIds((prev) => new Set(prev).add(request.requestId));
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
      {pendingPermissionRequest ? (
        <PermissionRequestPrompt
          request={pendingPermissionRequest}
          onResolve={(outcome) => handleResolvePermission(pendingPermissionRequest, outcome)}
        />
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
