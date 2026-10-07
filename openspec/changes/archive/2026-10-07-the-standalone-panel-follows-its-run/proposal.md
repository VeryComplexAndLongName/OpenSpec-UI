## Why

Found on 2026-10-07 while checking the-board-and-the-run-read-right in the
standalone app, on `copilot-cli-acp`: a run that asked for a permission
waited for ever after **Allow**, and the AI panel showed nothing more of
it. Two faults, both on `main`:

- **The answer went to the wrong agent.** The panel's `resolvePermission`
  names no agent. The standalone server routes a single-stage run's
  `cancel` and `stop` to the runner that holds the run, but not a
  `resolvePermission`, which went to the default runner, which had never
  heard of the run. The VS Code extension fixed the same fault on
  2026-10-02 (`CARRIES_NO_OWN_AGENT_ID` in `ai-panel.ts`); the server kept
  it.
- **The panel stopped hearing its run.** The standalone host passes the AI
  panel a new `onRunTerminal` on every render, and the panel subscribed to
  the transport again for each one. Unsubscribing left `FetchTransport`
  with no listener for a moment, and it closed its socket; the next command
  opened a new one, while the run's events went on to the closed one and
  were lost. Any render during a run - the schedule and the live runs are
  polled - could cut it off, a permission request or not.

## What Changes

- The standalone server routes a `resolvePermission` that names no agent to
  the runner that holds the run, as it does a `cancel` and a `stop`.
- The AI panel subscribes to its transport once per transport; it reads
  `onRunTerminal` through a ref.
- `FetchTransport` closes its socket only when nobody has subscribed again
  by the next task.

## Capabilities

### Modified Capabilities

- `acp-agent-adapters`: an answer from either host reaches the agent that
  asked.
- `shared-ui`: the AI panel follows its run to the end, however often its
  host renders.

## Impact

- `packages/server`: `websocket.ts`.
- `packages/webui`: `AiPanel.tsx`, `transport/fetch-transport.ts`.