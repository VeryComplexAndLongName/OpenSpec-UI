## Context

Read on 2026-09-03, after a live report against `copilot-cli-acp`:

- `agent-runner.ts` yields `cancelled` immediately after calling
  `abort()`, unconditionally — including when `activeRuns` held no
  controller for that `runId`.
- `agents/shared.ts`'s `terminateProcessTree` spawns `taskkill /T /F
  /PID` on Windows and swallows a spawn error with a comment saying there
  is no further fallback. It never checks the exit code and never
  confirms the process is gone.
- `acp-session-driver.ts`'s `run()` yields `cancelled` on abort and sets
  `done = true`; `runProcess()`'s `finally` terminates the tree
  afterwards.
- `HarnessChainPanel.tsx:45` and `AiPanel.tsx:877` both compute
  `isRunning` as "no terminal event has been seen", and render Cancel
  only while `isRunning`.

## Goals / Non-Goals

**Goals:**

- `cancelled` means the process is gone.
- A cancellation that has not taken effect is visible as such, and can be
  repeated.

**Non-Goals:**

- Guaranteeing that any process can be killed.
- Undoing work already written to the workspace.

## Decisions

### A distinct, non-terminal state for "asked, not yet stopped"

A new event kind reports that cancellation is in flight. It is not
terminal, so nothing downstream treats the run as over.

**Rejected alternative**: keep emitting `cancelled` immediately and have
the panel ignore it while later events arrive. Rejected — it puts the
correction in one consumer and leaves the protocol lying to every other.
The server, the extension, the journal and the audit log all read these
events; a fix that only the webui knows about is one host away from the
same bug.

**Rejected alternative**: emit nothing until the process dies. Rejected —
the user pressed a button and is entitled to see that it registered. An
unacknowledged click is why people press a button repeatedly, and here
each press would spawn another kill attempt.

### `cancelled` is emitted on the process's death

The run reports `cancelled` when the child has actually exited — which
the spawn path already observes, because it is already listening for
`close`. If it never exits, the run reports a failure that says so rather
than a cancellation that did not happen.

**Rejected alternative**: emit `cancelled` after a short delay, assuming
the kill worked. Rejected — a timer is a guess wearing the costume of a
confirmation, and it would reintroduce exactly the defect being removed.

### `terminateProcessTree` finds out whether it worked

It waits for `taskkill` to exit and reports the outcome to its caller.
Swallowing the result is what allowed a failed kill to be reported as a
successful cancellation.

**Rejected alternative**: leave it best-effort and rely solely on
watching for the child's exit. Rejected as insufficient rather than
wrong: watching the child is the authority on whether it died, but when
it does not, the caller needs to know whether the kill was even
attempted — "taskkill could not run" and "taskkill ran and the process
survived" call for different messages to the user.

### The Cancel control tracks the process, not the last event

Cancel remains available while a run is still producing events, and a
second press is allowed.

**Rejected alternative**: keep the sticky `isRunning` and add a separate
"force" control that appears after a failed cancellation. Rejected — two
buttons for one intention, and the second one only appears in the
situation where the user has already lost confidence in the first.

## Risks / Trade-offs

- **[Risk]** A new event kind is a protocol change both hosts must
  handle, and an unhandled kind is how a surface silently drops
  information. → **Mitigation**: the kind is non-terminal, so a consumer
  that ignores it behaves exactly as it does today — the failure mode of
  not knowing about it is the current behaviour, not a worse one.
- **[Trade-off]** `cancelled` now arrives later than the click. Accepted:
  that delay is the truth, and the in-flight state is what fills it.

## Open Questions

- Whether a repeated Cancel should escalate — a second press meaning
  something stronger than the first. Leaning against: the first press
  should already do everything available, and an escalation ladder
  implies the first rung was chosen to be gentle, which it was not.
