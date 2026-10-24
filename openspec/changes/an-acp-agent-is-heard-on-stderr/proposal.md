## Why

A review of the Codex integration (2026-10-24) found that the ACP session
driver spawns every ACP agent with stderr piped and never reads it. The
driver is shared by every ACP agent - `claude-cli-acp`, `copilot-cli-acp`,
`deepseek-cli-acp`, `codex-cli-acp`, and the product's own `local-llm-acp` -
which are the agents the owner's harness runs. Two things follow:

- **A stall.** A pipe nobody drains fills; an agent that writes its logs or
  progress to stderr then blocks on its next write, and the run stops
  mid-stage with nothing said.
- **A failure without its reason.** A CLI that is not signed in, or that
  crashes, says why on stderr and closes the connection. The run reported
  only that the connection closed.

The raw-text adapters read their stderr and hand it on as `stderr` events.

## What Changes

- The ACP driver reads an agent's stderr from the moment it is spawned, so
  the pipe never fills.
- What the agent writes there is handed on as `stderr` events, in the order
  it arrived relative to the run's other events, as the raw-text adapters
  do.
- A failed run's reason ends with the last of what the agent wrote to
  stderr (up to 4000 characters), where it wrote anything.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `acp-agent-adapters`: an ACP agent's stderr is read, handed on, and said
  beside a failure.

## Impact

- `packages/core/src/agents/acp-session-driver.ts` and its test.
- A changeset for core (patch); the extension and the server take it with
  core.
