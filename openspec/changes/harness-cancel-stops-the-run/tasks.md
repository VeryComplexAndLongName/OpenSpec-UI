Path this change must hold end to end: a `"cancel"` command arrives at
the runner → the runner finds that `runId`'s `AbortController` → the
signal reaches `spawnAndStream` → the process **tree** is terminated →
the stream ends with `cancelled` → the chain stops. A cancel that aborts
a controller nobody is listening to, or that kills a `cmd.exe` shim while
the agent keeps running, satisfies a naive test and leaves the defect in
place. Check each junction.

Note on local checks: `npm run lint` currently fails on this machine with
`ENOENT ... openspec/changes/agent-detection-timeout/.openspec.yaml`,
caused by a concurrent session's uncommitted archive moves. That failure
is **unrelated to this change** — do not attempt to fix it, and do not
mark a task complete on the strength of it.

## 1. Cancellable spawn

- [ ] 1.1 `packages/core/src/agents/shared.ts`, `spawnAndStream`: accept
  an optional `signal?: AbortSignal` in its options object. Optional, so
  every existing caller compiles and behaves exactly as today.
- [ ] 1.2 Same function: when the signal aborts while the child is
  running, terminate the child and end the stream with a `cancelled`
  event. Do **not** let the killed process's non-zero exit fall through to
  the existing `failed` branch — a run the user stopped is not a run that
  broke.
- [ ] 1.3 Same function: terminate the process **tree**, not only the
  direct child. On Windows use `taskkill /T /F /PID <pid>`; elsewhere kill
  the process group. `cross-spawn` resolves a `.cmd` shim through
  `cmd.exe` (see `packages/core/src/openspec.ts`'s header comment), so
  killing only the direct child would kill the shim and leave the agent
  running.
- [ ] 1.4 Same function: an already-aborted signal passed in before the
  spawn yields `cancelled` without spawning anything at all.
- [ ] 1.5 Same function: after abort, no further `stdout`/`stderr` events
  are emitted, and `cancelled` is emitted exactly once. The queue may hold
  buffered chunks at the moment of abort; drop them rather than emitting
  output after a terminal event, which ADR 0012's contract forbids.

## 2. Adapters pass the signal through

- [ ] 2.1 `packages/core/src/agent-runner.ts`: `AgentAdapter.execute()`
  receives the run's `AbortSignal`, and every adapter forwards it to
  `spawnAndStream`. Widen the adapter interface's `execute` signature
  once; do **not** add a separate mechanism per adapter.
- [ ] 2.2 `packages/core/src/agents/`: `claude.ts`, `copilot.ts`,
  `codex.ts`, `gemini.ts` each forward the signal. This is the only change
  to those files — do **not** alter any `buildInvocation()` argv.
- [ ] 2.3 `packages/core/src/agents/local-llm.ts` (or whichever adapter
  uses HTTP rather than a subprocess): forward the signal to its request
  instead. An adapter that ignores the signal is a silently
  non-cancellable agent.

## 3. The runner owns cancellation

- [ ] 3.1 `packages/core/src/agent-runner.ts`: the runner keeps a
  `Map<string, AbortController>` keyed by `runId`, populated when a run
  starts and deleted in the same `finally` that already ends the run.
- [ ] 3.2 Same file: a command with `kind === "cancel"` aborts the
  controller for `command.runId` and yields `cancelled`. It must **not**
  call `adapter.buildInvocation()`, must **not** call `adapter.execute()`,
  and must **not** record an audit entry with outcome `"started"` — today
  it does all three, spawning a billable agent whose prompt is "Stop the
  current execution".
- [ ] 3.3 Same file: a `"cancel"` for an unknown `runId` yields
  `cancelled` and does nothing else. It is **not** an error: the run may
  have finished between the click and the command's arrival.
- [ ] 3.4 Same file: the cancelled run's own audit entry records outcome
  `"cancelled"`, as it already does through `lastOutcome`. Do not add a
  second audit entry for the cancel command itself — nothing ran.

## 4. Callers stay as they are

- [ ] 4.1 `packages/extension/src/run-controller.ts`: leave
  `{ ...this.activeCommand, kind: "cancel" }` unchanged. It was already
  sending the right command; only its handling changes.
- [ ] 4.2 `packages/core/src/harness-chain-runner.ts`: leave
  `cancel()`'s existing behavior unchanged **except** its doc comment,
  which currently states "This product has no hard child-process-kill
  mechanism for any single-stage run today" and "does not guarantee the
  underlying CLI process exits early". Both become false — rewrite them to
  say what now holds. Do not delete the comment.
- [ ] 4.3 `packages/server/src/websocket.ts`: no change. A WebSocket
  `"cancel"` message already reaches a runner, which is now the thing that
  handles it.

## 5. Tests

- [ ] 5.1 `packages/core/src/agents/shared.test.ts`: aborting mid-run ends
  the stream with `cancelled`, and no `stdout`/`stderr` event is emitted
  after it.
- [ ] 5.2 Same file: an already-aborted signal produces `cancelled` with
  no process spawned — assert the spawn helper was not called, not merely
  that the result was `cancelled`.
- [ ] 5.3 `packages/core/src/agent-runner.test.ts`: a `"cancel"` command
  yields `cancelled` **and** `adapter.buildInvocation` and
  `adapter.execute` were never called. Assert the absences explicitly:
  asserting only the `cancelled` event passes today, with the defect
  present.
- [ ] 5.4 `packages/core/src/agent-runner.test.ts`: a `"cancel"` for an
  unknown `runId` yields `cancelled` without throwing.
- [ ] 5.5 `packages/core/src/agent-runner.test.ts`: cancelling a running
  run causes that run's stream to end with `cancelled` and its audit entry
  to record outcome `"cancelled"`, with no `"started"` entry for the
  cancel command.
- [ ] 5.6 A test that the process-tree kill is used rather than a bare
  `child.kill()` — assert against the termination helper, since a unit
  test cannot observe an orphaned grandchild. State in the test's own name
  that it guards the `.cmd`-shim case from design.md.

## 6. Verification

- [ ] 6.1 `openspec change validate --strict harness-cancel-stops-the-run`.
- [ ] 6.2 `npm run typecheck` and `npm run test` — green across all four
  workspaces. See the note at the top of this file about `npm run lint`.
  `sprint-report.test.ts` and `change-timeline.test.ts` have pre-existing
  Windows timeout flakes at 5000 ms under load; do not attempt to fix them
  here.
- [ ] 6.3 `git diff packages/core/src/agents/` shows only the signal being
  forwarded — no `buildInvocation()` argv changed. An argv change here
  means the change reached further than it should.
- [ ] 6.4 Version bump via `npx changeset` (`@openspec-ui/core` minor).
- [ ] 6.5 **Human-only, cannot be completed by an implementing agent**:
  start a real chain stage, press Cancel, and confirm three things — the
  agent's OS process is gone (check the process list, as was done on
  2026-09-01 for PID 20420), the workspace lease stops being renewed, and
  no second agent process was spawned by the cancel itself. Leave
  unchecked if you are an agent.
