## Why

Reported on 2026-09-03, on a chain running GitHub Copilot CLI over ACP.
The user pressed Cancel. The panel said it was cancelling, then said the
run was cancelled — and the agent carried on working. The Cancel button
was gone, so there was no way to ask again.

Both halves are visible in the source.

**The `cancelled` event is a report of intent, not of fact.**
`agent-runner.ts`:

```ts
activeRuns.get(command.runId)?.abort();
yield { kind: "cancelled", runId: command.runId, timestamp: nowIso() };
```

`abort()` only fires listeners. The listener that kills the process
(`terminateProcessTree`) is asynchronous and best-effort, and the `yield`
does not wait for it or check it. The event is emitted even when
`activeRuns.get()` returned nothing and there was never anything to
abort. The ACP driver does the same in the other direction: on abort it
sets `done = true` and returns `cancelled`, and its `finally` kills the
process *after* the generator has already reported success.

**The panel then removes the only control.** Both
`HarnessChainPanel.tsx` and `AiPanel.tsx`:

```ts
const isRunning = runId !== null && !collapsedEvents.some(isTerminal);
```

That is sticky: once any terminal event is in the list, `isRunning` is
false for the rest of that run. Cancel renders only while `isRunning`, so
it disappears — while the events the live process keeps producing carry
on filling the log underneath a "Cancelled" label.

The first half is an inaccuracy. The second is a loss of control, and it
is the one that matters: the interface believes its own optimistic event
and withdraws the user's only lever. Even if the kill succeeded nine
times out of ten, the tenth leaves someone watching an agent edit their
files with nothing to press.

This is the same family this repository has been clearing all week — a
control reporting a success it never checked. The cost here is higher
than a setting that quietly does nothing: it is an agent that keeps
changing the workspace after being told to stop.

## What Changes

- `packages/core`: a run reports `cancelled` when the process is gone,
  not when the request was made. Until then it reports a distinct,
  **non-terminal** state, so a caller can tell "asked to stop" from
  "stopped".
- `packages/core/src/agents/shared.ts`: `terminateProcessTree` finds out
  whether it worked. Today `taskkill` failures are swallowed and nothing
  confirms the process is gone.
- `packages/webui`: the Cancel control survives a cancellation that has
  not taken effect, and can be pressed again. A run that is still
  emitting events is still running, whatever the last terminal event
  claimed.

## Capabilities

### New Capabilities

(none — this extends `execution-core`)

### Modified Capabilities

- `execution-core`: cancellation is reported on the process's death, not
  on the request; and a request that has not taken effect leaves the
  caller able to repeat it.

## Impact

- `packages/core/src/protocol.ts`: a non-terminal cancellation-in-flight
  event kind, which both hosts must handle.
- `packages/core/src/agent-runner.ts`,
  `packages/core/src/agents/acp-session-driver.ts`,
  `packages/core/src/agents/shared.ts`,
  `packages/core/src/harness-chain-runner.ts`.
- `packages/webui/src/components/AiPanel.tsx`,
  `packages/webui/src/components/HarnessChainPanel.tsx`.

## Explicitly out of scope

- Making an agent process cancellable that cannot be killed at all. If a
  process survives every escalation this change can honestly do no more
  than say so — which is the whole point, and better than the current
  claim that it stopped.
- Cancelling work an agent has already done. Rollback is
  `WorkbenchRecoveryService`'s job and is unchanged.
