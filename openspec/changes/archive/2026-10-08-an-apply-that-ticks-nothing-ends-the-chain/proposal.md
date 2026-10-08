## Why

On 2026-10-08, while checking the-agent-asks-the-operator, two chains went
on from an implementing stage that had done nothing. In one, the operator's
answers to the agent's question did not settle it, and the agent ended its
turn without changing a file or ticking a task. In the other, the agent's
only file write failed and it ended the same way. Each time the chain went
on to `verify`, which had nothing to confirm, and to `archive`, which
refused because the tasks were unticked. Two stages ran for nothing, and
the reason the chain stopped - the implementing stage did nothing - was
said nowhere; the refusal at `archive` said only that tasks were open.

The owner decided the same day: stop the chain right after such an apply.

## What Changes

- An implementing stage that completes having changed no file and ticked no
  task, while a task it could do (not **Human-only**, not delegated) is
  still open, ends the chain as failed. The failure says what happened and
  names the open tasks. `verify` and `archive` do not run.
- An implementing stage that changed files and ticked no task is unchanged:
  it is named, and the chain goes on to `verify`, which may tick what it
  confirms (a-done-task-is-ticked).
- Where the change to the working directory could not be read, nothing is
  decided from it, as before.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `agentic-harness`: an implementing run that did nothing ends the chain.

## Impact

- `packages/core/src/harness-chain-runner.ts` and its tests.
- `HARNESS.md`: the stage table's `apply` row.
- A changeset: core, minor.
