## Context

See `proposal.md` for the live diagnosis. Facts read from the code:

- `spawnAndStream` holds its child in a local `const child`, pushes
  `child.on("close")` into a queue an async generator awaits, and yields
  `completed` on exit code 0, `failed` otherwise. It has no parameter for
  cancellation and exposes no handle.
- `agent-runner.ts` branches on `event.kind === "cancelled"` only to
  record `lastOutcome`; it has no branch on `command.kind === "cancel"`.
- `"cancel"` is a real `CommandKind`, sent by three independent callers:
  `packages/extension/src/run-controller.ts` (`{ ...this.activeCommand,
  kind: "cancel" }`), `HarnessChainRunner.cancel()`, and WebSocket clients
  (`packages/server/src/server.test.ts` sends one directly).
- `packages/core/src/openspec.ts`'s header records that on Windows
  `cross-spawn` is required because agents are installed as `.cmd` shims
  that plain `execFile` cannot resolve.
- `commandInstruction("cancel")` returns "Stop the current execution for
  the change described below." — a prompt, delivered to a fresh agent.

## Goals / Non-Goals

**Goals:**

- Make Cancel stop the process it names.
- Stop a cancel command from costing an agent run.
- Leave the wire protocol and every existing caller unchanged.

**Non-Goals:**

- Timeouts, budget-triggered aborts, or any automatic cancellation
  policy. This change supplies the mechanism only.
- Graceful in-agent shutdown. There is no protocol by which these CLIs
  accept a "wind down" instruction; termination is termination.

## Decisions

### `"cancel"` is handled by the runner, never by an adapter

`createAgentRunner`'s returned runner keeps a `Map<runId,
AbortController>` for the runs it started. A command of kind `"cancel"`
looks up `command.runId`, aborts it, and yields `cancelled` — without
calling `buildInvocation()`, without spawning, and without recording an
audit entry for a run that never started.

**Rejected alternative**: keep sending `"cancel"` to the adapter and have
each adapter recognize it. Rejected — every adapter would need the same
branch, and forgetting it in one adapter reintroduces exactly today's
defect for that agent alone, silently. The runner is the single place
that already owns the run's lifecycle.

**Rejected alternative**: remove `"cancel"` from `CommandKind` and add a
separate control channel. Rejected — three independent callers send it
today, including WebSocket clients whose messages this project does not
control the shape of. The command is fine; what it does is not.

### Cancelling an unknown `runId` is not an error

A `"cancel"` for a run the runner does not know — already finished,
already cancelled, or never started here — yields `cancelled` and does
nothing else.

**Rejected alternative**: fail the cancel command. Rejected — cancel is
inherently racy: the run may finish between the user's click and the
command's arrival. Reporting a failure for a run that is already stopped
would make the UI show an error for the outcome the user wanted.

### Termination kills the process tree

On abort, the whole child tree is terminated, not just the direct child.

**Rejected alternative**: `child.kill()` alone. Rejected on this
repository's own recorded evidence: `openspec.ts`'s header explains that
Windows agents are `.cmd` shims resolved by `cross-spawn` through
`cmd.exe`. Killing the direct child there kills the shim and leaves the
real agent running — the exact failure this change exists to fix, with a
green test to hide it. The live-observed run (`claude` as a direct child
of the extension host) would have been fine; `copilot`, documented in
this repository as a `.cmd` shim, would not.

### An aborted run ends as `cancelled`, not `failed`

**Rejected alternative**: let the killed process's non-zero exit produce
`failed`, as `spawnAndStream` does for any non-zero exit today. Rejected
— per ADR 0012's terminal-event contract each terminal kind means
something specific, and a run the user stopped is not a run that broke. A
chain distinguishes them (`outcome !== "completed"` stops either way, but
the recorded history and the UI do not), and so does the audit log.

## Risks / Trade-offs

- **[Risk]** A killed agent may leave a half-written file. →
  **Mitigation**: this is the existing checkpoint's problem domain, not a
  new one — `checkpoint.ts` snapshots before a mutating run precisely so
  an incomplete run can be rolled back, and `RollbackResult.conflicts`
  already reports what it could not restore. A run that cannot be stopped
  at all leaves the same partial state, just later.
- **[Risk]** Tree termination could kill a process the agent legitimately
  spawned and that another part of the system depends on. →
  **Mitigation**: the tree is rooted at a process this runner spawned for
  this run; nothing else in this project shares that root.
- **[Trade-off]** Cancellation is abrupt. Accepted — the alternative
  requires a shutdown protocol none of these CLIs offer, and today's
  behavior is no cancellation at all.

## Migration Plan

Additive at every boundary. `spawnAndStream`'s new parameter is optional,
so an adapter that does not pass it behaves exactly as today. No
`CommandKind`, `EventKind`, transport message, or configuration file
changes. The three existing callers of `"cancel"` are untouched: they
already send the right command, and only its handling changes.

## Open Questions

None. Timeout policy and budget-triggered aborts are named as non-goals
rather than left open, because both need this mechanism first and neither
changes its shape.
