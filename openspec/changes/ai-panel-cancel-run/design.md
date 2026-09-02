## Context

See `proposal.md`. Facts read from the code:

- `HarnessChainPanel.tsx` renders `Cancel` under
  `isRunning && !pendingCheckpoint`, calling a four-line helper:
  `sendOnCurrentRun(kind)` reads `runIdRef.current`, returns early when
  it is null, and sends `{ kind, cwd, runId, context: { changeDir } }`.
- `AiPanel.tsx` already holds `runIdRef.current`, already derives
  `isRunning` as `runId !== null && !collapsedEvents.some(isTerminal)`,
  and already sends through the same `transport.send(command)`.
- `AiPanel` builds its run command with a `context` of
  `{ changeDir: effectiveChangeDir, promptContext }`, where
  `effectiveChangeDir` is the changes root for `list` and a specific
  change directory otherwise.
- `RunController.cancel()` (extension) sends
  `{ ...this.activeCommand, kind: "cancel" }` and returns `false` when
  there is nothing active.
- `agent-runner.ts` (after `harness-cancel-stops-the-run`) handles
  `kind === "cancel"` at the top of `run()`: it aborts the controller for
  that `runId`, yields `cancelled`, and never builds an invocation,
  spawns a process, or records a run start. An unknown `runId` yields
  `cancelled` without error.

## Goals / Non-Goals

**Goals:**

- Make an in-flight single-stage run cancellable from the panel it was
  started in.
- Say what `openspec-ui.cancelProcess` actually cancels.

**Non-Goals:**

- Changing cancellation semantics. They shipped already.
- A cancel affordance in the Processes tree for harness runs.
- Relaxing the `assisted` chain refusal.

## Decisions

### The button mirrors the chain panel rather than inventing a second shape

`AiPanel` gets the same helper `HarnessChainPanel` has: read the active
run id, return early if absent, send a `cancel` command on it.

**Rejected alternative**: route the panel's cancel through
`RunController.cancel()` in the extension. Rejected — `AiPanel` is shared
by both delivery targets, and `RunController` exists only in the
extension. Routing through it would make the standalone UI's cancel work
differently from the extension's, or not at all, for a control whose whole
point is that it behaves the same everywhere.

**Rejected alternative**: a generic "send any command on the current run"
helper hoisted into shared code for both panels. Rejected for now — two
four-line copies whose shapes already differ (`AiPanel` carries
`promptContext`, the chain panel does not) are cheaper to read than one
abstraction with a options bag, and nothing yet needs a third caller.

### Cancel is shown only while a run is in flight

The button renders under `isRunning`, the same derived value the Run
button already uses to disable itself.

**Rejected alternative**: always render it, disabled when idle. Rejected —
the panel's control row is already five wide; a permanently present,
usually disabled control adds noise for a state the status label already
reports.

### A cancel for a run that just ended is harmless, and is not guarded against

Between rendering and clicking, a run can finish. The command is sent
anyway.

**Rejected alternative**: re-check `isRunning` at click time and suppress
the send. Rejected — `agent-runner.ts` already treats a `cancel` for an
unknown `runId` as a no-op that yields `cancelled`, deliberately, because
the race is inherent. A second guard in the UI would duplicate a decision
already made in core, and would drift from it.

### The extension command is renamed, not repointed

`openspec-ui.cancelProcess` keeps cancelling implementation sessions; only
its title changes to say so.

**Rejected alternative**: make it also cancel harness runs, dispatching on
the process kind. Rejected — the Processes tree's items and the harness's
runs are different lifecycles with different owners, and merging them
behind one command is a decision about what that view represents, not a
naming fix. This change removes the misleading title; it does not answer
the larger question.

## Risks / Trade-offs

- **[Risk]** A user cancels mid-write and the change directory is left
  half-edited. → **Mitigation**: unchanged from today — this is what the
  Workbench checkpoint and its rollback exist for, and the alternative
  (no cancel at all) leaves the same partial state, just later and after
  a manual process kill.
- **[Trade-off]** Two near-identical four-line helpers in two panels.
  Accepted, with the reason recorded above; the third caller is what
  should trigger extracting one.

## Migration Plan

None. A new control and a renamed command title; no configuration, no
protocol, no stored state.

## Open Questions

None.
