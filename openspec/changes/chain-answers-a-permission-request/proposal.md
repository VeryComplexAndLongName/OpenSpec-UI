## Why

A chain run stopped at its agent's first permission request and never
resumed. The agent asked, the operator clicked Allow, and nothing
happened for twelve minutes — until a second ACP subprocess appeared,
started by that very click.

`AcpSessionDriver` stores a resolver keyed `runId:requestId` and awaits
it. Nothing resolves it, because `HarnessChainRunner.asAgentRunner()`
special-cases exactly one command kind:

```ts
if (command.kind === "cancel") { … }
return this.run(command);
```

and `run()` accepts exactly one:

```ts
if (command.kind !== "chain") {
  yield failedEvent(runId, `HarnessChainRunner.run only accepts "chain" commands, got "${command.kind}"`);
```

So `"resolvePermission"` reaches the chain and becomes a **failed event**
rather than an answer. The stage's agent waits for a promise that can no
longer be resolved by anything, and a chain that cannot be answered
cannot be finished either — the operator's only remaining move is to kill
the process.

There is a second half. `HarnessChainPanel.tsx` contains no permission
handling at all: no `permissionRequest`, no Allow/Deny, no
`resolvePermission`. The controls the operator saw belonged to
`AiPanel`, which is built for a single-stage run and answers with the
run id it is tracking — the chain's, not the stage's. Even if the command
had been forwarded, `runId:requestId` would not have matched.

This is the same shape as the defect `harness-cancel-stops-the-run`
fixed: a command kind that the chain does not route to the runner that
owns the run. That change fixed cancellation and did not generalise, and
this is the second instance.

## What Changes

- `asAgentRunner()` routes `"resolvePermission"` to the runner executing
  the current stage, rather than to `run()`.
- The chain tracks which runner owns the stage in flight, so there is
  something to route to. Cancellation already needs this and does it
  through `ChainState`; permission needs the runner itself.
- `permissionRequest` events carry through the chain's stream with the
  stage's run id intact, so an answer names what the driver is waiting
  for.
- `HarnessChainPanel` gains the Allow/Deny control, answering with the
  id from the event rather than the id of the run it is watching.
- A stage whose agent asks for permission while nothing can answer —
  `autonomous`, where there is no confirmation channel by construction —
  fails with that reason rather than hanging.

## Capabilities

### Modified Capabilities

- `agentic-harness`: a permission request raised inside a chain can be
  answered, and one that cannot be answered ends the run instead of
  suspending it forever.

## Impact

- `packages/core/src/harness-chain-runner.ts`,
  `packages/webui/src/components/HarnessChainPanel.tsx`. Changeset
  needed: `core` and the two hosts that render the panel.

## Explicitly out of scope

- **Answering on the operator's behalf.** A default of "allow" would make
  `autonomous` work by removing the gate the request exists to be. The
  run failing with a stated reason is the correct outcome; whether a
  stage may auto-approve is a separate decision with its own proposal.
- **`claude-cli-acp`'s absence of a permission callback.** It has none in
  this mode, which is why it is a usable workaround today. Adding one is
  the upstream CLI's business, not this project's.
- **Generalising command routing.** Two kinds now need forwarding, and a
  third may later. Building a general dispatcher for two known cases
  would be speculative; this change routes the second one and leaves a
  named place for the third.
