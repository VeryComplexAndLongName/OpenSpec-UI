## Why

Observed live on 2026-09-01: a chain stage was running, Cancel was
pressed in the AI panel, and nothing happened at all. Diagnosed rather
than guessed:

- The stage's process was still alive fifteen minutes later —
  `claude -p --output-format text --dangerously-skip-permissions --model
  claude-opus-5`, PID 20420, a direct child of the extension host — and
  the cross-host lease was still being renewed on its behalf, so the
  workspace mutation lock was still held. It had to be killed by hand.
- `packages/core/src/agents/shared.ts`'s `spawnAndStream` contains **zero**
  occurrences of `AbortSignal`, `signal` or `kill`. The child process is
  held in a local variable inside the generator and never exposed, so
  there is no mechanism anywhere in this project to stop a running agent.
- `packages/core/src/agent-runner.ts` contains **no** branch on
  `kind: "cancel"`. A cancel command therefore takes the ordinary path:
  `buildInvocation()` → `spawnAndStream()` — **spawning a second, billable
  agent process** whose entire prompt is `commandInstruction("cancel")`,
  "Stop the current execution for the change described below."

So cancelling starts a new paid agent run to ask another agent to stop,
which that agent cannot hear, while the run being cancelled continues.

The limitation is documented, honestly, in `HarnessChainRunner.cancel()`'s
own comment ("no hard child-process-kill mechanism … does not guarantee
the underlying CLI process exits early"), so this is designed behavior
rather than a regression. But the best-effort half is worse than nothing:
it achieves no cancellation and costs money, and `agent-usage-accounting`
now makes that cost visible.

It also blocks work already planned. `harness-suspendable-stage` gives a
stage a way to stop waiting; it does not give anything a way to stop
*running*. And ADR 0018 decision 7 explains that a budget cannot abort a
run in flight because cost arrives at the end — true, but today a budget
could not abort a run even knowing it should, because no abort exists.

## What Changes

- `packages/core/src/agents/shared.ts`: `spawnAndStream` accepts an
  optional `AbortSignal`. On abort it terminates the spawned process and
  ends the stream with `cancelled`.
- Same file: termination kills the process **tree**, not only the direct
  child. On Windows `cross-spawn` resolves a `.cmd` shim through
  `cmd.exe` (already documented in `packages/core/src/openspec.ts`'s own
  header comment), so killing the direct child would orphan the real
  agent process.
- `packages/core/src/agent-runner.ts`: a runner tracks the
  `AbortController` of each run it starts, and a command of kind
  `"cancel"` aborts the run with that `runId` **without** building an
  invocation, spawning anything, or recording a run start.
- `packages/extension/src/run-controller.ts` and
  `packages/core/src/harness-chain-runner.ts`: both already send a
  `"cancel"`-kind command; they keep doing so. The command stays part of
  the protocol — WebSocket clients send it too — only its handling
  changes.

## Capabilities

### New Capabilities

(none — this extends `execution-core`)

### Modified Capabilities

- `execution-core`: a cancel command stops the run it names instead of
  starting a new agent process, and a running agent process can be
  terminated.

## Impact

- `packages/core`: `agents/shared.ts`, `agent-runner.ts`. Every adapter
  that calls `spawnAndStream` gains cancellation without changing its own
  code, because the signal travels with the call.
- No change to `CommandKind`, `EventKind`, or any transport. `"cancel"`
  is already in the protocol and already sent by `server`'s WebSocket
  layer, the extension's `RunController`, and `HarnessChainRunner`.
- The `cancelled` terminal event already exists and is already handled
  everywhere; this change makes it reachable for a running process.

## Explicitly out of scope

- Run timeouts. A run that hangs without anyone pressing Cancel is a
  different problem; this change gives it the mechanism it would need,
  but adding a policy on top is separate work.
- Aborting a run on budget exhaustion (ADR 0018 decision 7 keeps budget
  enforcement at stage boundaries; that decision is unchanged here).
- `harness-suspendable-stage`'s suspended state, which concerns a stage
  that is *waiting*, not one that is *running*.
