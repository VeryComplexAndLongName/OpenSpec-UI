## Why

Found while writing `agentic-harness-documentation`'s agent reference
table, which reads its columns out of `HARNESS_AGENT_CAPABILITIES`.

That table has rows for `claude-cli`, `copilot-cli`, `codex-cli`,
`gemini-cli`, `local-llm` and `vscode-chat`. It has **no rows for the
four ACP adapter ids**. An id absent from the table means, by the table's
own documented contract, "this agent has no mechanism for it at all", so
`assertValidStepAgents` refuses `effort` and `budget` on any of them.

For two of the four that is wrong, and demonstrably so:

- `agents/copilot-acp.ts` renders `--effort <level>` and
  `--max-ai-credits <n>`, and `default-runners.ts` explicitly permits both
  in `copilot-cli-acp`'s allowlist entry, with the same validators the
  plain `copilot-cli` entry uses.
- `agents/claude-acp.ts` renders `--effort <level>` and
  `--max-budget-usd <n>`, permitted the same way.

So the adapter builds the flag, the allowlist admits the flag, and the
validator refuses the configuration that would produce it. A user writing
`{ "agent": "copilot-cli-acp", "budget": { "maxAiCredits": 100 } }` is
told the agent has no spending-cap mechanism, about an agent whose
spending-cap flag is three lines further down the same repository.

The other two are correct as they stand: `codex-acp.ts` and
`gemini-acp.ts` each state in their own header comments that they render
no model, effort or budget flag, and their allowlist entries permit none.

This is the mirror image of the defect `harness-config-strictness` was
written to remove. There the validator accepted a setting nothing could
honour; here it refuses one the runtime honours. Both are the same
failure — the validator and the runtime disagreeing about what an agent
can do — and both cost a user an investigation. The refusal is the more
confusing direction, because it presents as a deliberate decision.

The immediate consequence is worse than an inconvenience. `copilot-cli`
is the cheap agent, `--max-ai-credits` is its only spending cap, and
`copilot-cli-acp` is the adapter this project recommends for structured
output. Today those three cannot be combined: a user who wants ACP must
give up the spending cap, and a user who wants the cap must give up ACP.

## What Changes

- `packages/core/src/harness-step-agent.ts`: `HARNESS_AGENT_CAPABILITIES`
  gains rows for `copilot-cli-acp` and `claude-cli-acp`, each identical
  to its plain counterpart, because each runs the same binary with the
  same flags.
- Same file: rows for `codex-cli-acp` and `gemini-cli-acp` with empty
  capabilities — explicit rather than absent, so a reader can tell a
  deliberate "no mechanism" from a forgotten row. The absence of a row is
  what produced this defect.
- A test that the two sets cannot drift apart again: every id in
  `AGENT_REGISTRY` has a row, and an ACP id's capabilities match those of
  the agent it wraps unless its adapter renders nothing.

## Capabilities

### New Capabilities

(none — this extends `agentic-harness`)

### Modified Capabilities

- `agentic-harness`: an agent's accepted reasoning effort and spending
  cap are the same whether it is selected through its plain adapter or
  its ACP one, since both spawn the same binary with the same flags.

## Impact

- `packages/core/src/harness-step-agent.ts` and its test.
- `packages/webui` and `packages/extension` settings surfaces gain effort
  and budget controls for two more ids, with no code change: both read
  the same table.
- No adapter and no allowlist change — both are already correct, which is
  what makes this a one-table fix.

## Explicitly out of scope

- Giving `codex-cli-acp` or `gemini-cli-acp` a mechanism they do not
  have. Their adapters render nothing deliberately, for reasons recorded
  in their own headers.
- Any change to what the flags do, or to the version requirements
  recorded in `verified-agent-versions.ts`.
