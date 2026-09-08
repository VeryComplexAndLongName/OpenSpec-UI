## Why

A ceiling can be configured, saved, accepted by validation, and do
nothing at all — and nothing says so.

Three of these exist today and every one is reachable by an ordinary
choice:

- `budget.maxCostUsd` with `copilot-cli-acp` on a stage. That agent
  reports tokens and no cost, so the ceiling has nothing to compare and
  never fires, however large the spend.
- `budget.maxTokens` with `claude-cli-acp`. It counts
  `inputTokens + outputTokens`, and a measured run of that agent moved
  1,693,507 cache tokens against 8,322 counted ones — a two-million
  ceiling would not have fired on it, or on two hundred more like it.
- Any spending ceiling over `claude-cli`, `copilot-cli`, `codex-cli`,
  `gemini-cli`, `local-llm` or `vscode-chat`. Six of the ten supported
  agents report nothing, so nothing is counted and nothing ever fires.

Each of these is documented in `LIMITS.md`. That document exists because
these facts are surprising, and it is read by someone who already
suspects a problem — not by the person confidently setting a ceiling that
will never act.

The gap is not documentation. **Nothing in the code records which agents
report usage.** `HARNESS_AGENT_CAPABILITIES` records what each agent's
command line accepts — its effort values, its budget flag — and says
nothing about what it reports back. So the product cannot warn about any
of the above even in principle: the fact it would need lives only in a
Markdown table.

This blocks the two changes queued behind it. A settings template that
picked a ceiling matching the chosen agent, and a recommendation drawn
from what similar changes cost, both need the machine to know which
figures exist.

## What Changes

- What each agent reports becomes a recorded capability beside what its
  command line accepts, with the measured evidence named — including
  "not observed", which is the honest state for two of the ACP adapters.
- A function that reads a resolved configuration and reports what it
  cannot do: every ceiling that cannot fire, and every stage left with no
  effective bound at all.
- The result is shown where the configuration is chosen, not only on
  request.

## Capabilities

### Modified Capabilities

- `agentic-harness`: a configuration explains which of its ceilings
  cannot act, before a run rather than after the bill.

## Impact

- `packages/core`: the capability field, and the reader over a resolved
  config. `packages/webui`'s harness settings view, and a command in
  `packages/extension`. Changeset for `core`, `webui` and the extension.

## Explicitly out of scope

- **Refusing a configuration whose ceiling cannot fire.** It is a
  legitimate thing to write: an operator may set a cost ceiling that
  binds three of four stages and accept that the fourth is unbounded.
  Refusing would make the harness harder to use in exchange for a
  judgement that is the operator's.
- **Recommending a value.** Saying "this cannot fire" needs only what the
  agent reports. Saying "set it to $8" needs history, and that is the
  change after the templates.
- **Guessing at an unobserved agent.** `gemini-cli-acp` and
  `codex-cli-acp` have never been measured here. They are recorded as
  unknown and reported as unknown; asserting either way would be
  inventing a measurement.
