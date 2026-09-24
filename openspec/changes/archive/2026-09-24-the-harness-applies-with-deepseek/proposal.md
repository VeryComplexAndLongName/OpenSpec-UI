## Why

Asked by the owner on 2026-09-24, to run this repository's own changes
through the harness: apply with DeepSeek, review with GitHub Copilot on
its Codex model, everything else as it was.

## What Changes

`openspec/agent-harness.json`, the workspace-wide default:

- `apply` runs `deepseek-cli-acp`. It takes no model, effort or per-stage
  budget: its registry entry declares none.
- `review` runs `copilot-cli-acp` with model `gpt-5.3-codex`, effort
  `high`. The name asked for was `chatgpt-5.3-codex`; Copilot CLI 1.0.83
  refuses it ("Model ... is not available") and answers under
  `gpt-5.3-codex`, checked on 2026-09-24 with a one-word prompt (2.84 AI
  Credits). A made-up name was refused the same way, so the check tells
  the two apart.
- A time ceiling: an hour per stage, three hours per run. DeepSeek reports
  no usage, so the chain's `maxCostUsd` of 15 cannot act on `apply`, and
  without a timeout core's own findings said the stage could run with no
  bound at all. The owner chose these two numbers.

`propose` and `verify` keep `claude-cli-acp` on `claude-opus-5`, effort
`high`; the autonomy level, the review gate and the budget are unchanged.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none - the workspace's own configuration)

## Impact

- `openspec/agent-harness.json` only. No `packages/*` change and no
  changeset.
- Core's findings on the resolved file, as the settings surfaces will
  show them: the cost ceiling cannot act on `review` (Copilot reports
  tokens, not cost) nor on `apply` (DeepSeek reports nothing). Both are
  left as they are; the time ceiling is what bounds `apply`.
