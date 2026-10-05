## Why

[ADR 0039](../../../docs/adr/0039-the-supervisor-advises.md), decision 4,
and the owner's answers of 2026-10-04: the supervisor may change the agent
of a stage when one fails, where a change's configuration allows it, and
always says so. The policy is configured: which agents a stage falls back
to, and whether a fallback may cost more or go to another provider.

`the-supervisor-advises` diagnoses a failure and says whether repeating it
can help. Today a chain that fails on "not signed in" or "not installed"
ends there, and one cut by a passing rate limit or server error ends there
too: `maxStageAttempts` repeats only a stage a ceiling cut.

## What Changes

- **`supervisor.mode: "act"`**, in a change's own `harness.json` only, and
  only with `autonomyLevel: "autonomous"` and `maxStageAttempts` above 1.
  Under `act`, when a stage fails, the chain asks the supervisor:
  - repeating is likely to help (rate-limited, server error): the stage is
    attempted again on the same agent;
  - repeating will not help (not installed, not signed in, blocked,
    network): the stage moves to the next agent of
    `supervisor.fallback.<stage>` that the policy allows;
  - otherwise, or with no attempt left, the chain fails as it does today.
- **The policy.** `supervisor.fallback`, an ordered list of agents per
  stage, in either file. `supervisor.allowCostIncrease` and
  `supervisor.allowProviderChange`, per change only, both false by default.
  A move to an agent of another provider (Anthropic, GitHub, OpenAI, Google,
  DeepSeek, the local model) needs the second; any move except to the local
  model needs the first, since nothing here knows one service's price
  against another's.
- **Always said.** The chain's timeline shows the move and why: "the
  supervisor moved apply from copilot-cli-acp to claude-cli-acp: the agent
  is not signed in". The audit log records it. The move is never silent,
  and a policy that refused a fallback says which rule refused it.
- **Under `advise`**, a change whose last run cannot be repeated is told
  which fallback agent the policy would allow.
- **From the UI.** A change's Harness Settings offer Act, with a warning
  about cost and providers, the fallback agents per stage, and the two
  allowances.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `agentic-harness`: `act`, the fallback policy, and how a chain repeats
  or moves a failed stage.
- `shared-ui`: the change's Harness Settings for them.
- `ci-cli`: `run` says when the supervisor moved or repeated a stage.

## Impact

- `packages/core`: `harness-config.ts` (the new keys and their rules),
  `agents/registry.ts` (each agent's provider), `supervisor.ts` (the
  decision), `harness-chain-runner.ts` (holding a stage's failure until the
  decision, and acting on it).
- `packages/webui`: the change's Harness Settings.
- `packages/cli`: `render-run.ts`.
- `packages/extension`: regenerated schemas.
- `HARNESS.md`.
- No event kind is added: a move is a `progress` event and the next
  `stageStarted`, which already carries the attempt and its reason.
