## Why

The owner asked on 2026-09-19:

> Harness Settings - "Run budget" is counted in $. And what if some agents
> work on credits and some on dollars? Perhaps make "Run budget"
> independent of the unit ... Go by claude-cli-acp alone? That is not
> right.

They are right about the hole and, read carefully, right to be uneasy
about the fix they suggested.

**The hole.** A stage's own cap already speaks the agent's unit:
`stepAgents.<stage>.budget` takes `maxCostUsd` for an agent billed in
dollars and `maxAiCredits` for one billed in credits, refuses the wrong
one, and reaches that agent's own command line. The **chain's** ceiling
does not: `budget.maxCostUsd` and `budget.maxTokens` are all there is, so
a chain whose stages are billed in credits has no chain-level ceiling at
all. `AgentUsage` already carries `cost: { amount, currency }` for exactly
this, "kept whole rather than converted" - and nothing reads it.

**Why not a unitless number.** One field meaning dollars on one stage and
credits on the next would be summed by this product into a total that
means nothing, and compared against a ceiling that means nothing. The
reasoning is already written in `agent-usage.ts`, where `cost` and
`costUsd` were kept apart rather than folded: converting would mean
inventing an exchange rate, and reusing the dollar field for another
currency "would read correctly for a year and then bill someone wrongly".
A ceiling that cannot be trusted is worse than no ceiling, because it is
believed.

**What "go by claude-cli-acp alone is not right" deserves.** A ceiling
that cannot act on a stage is already reported before a run
(`findHarnessConfigLimits`, and the requirement "A configuration says
which of its ceilings cannot act"). That reading knows about cost and
tokens. It will not know about a ceiling in credits unless it is taught,
and a new ceiling nobody can check is exactly the failure the existing
requirement exists to prevent.

## What Changes

- **A chain ceiling per unit.** `budget.maxCost` takes a ceiling per
  currency code - `{ "credits": 500 }`, `{ "EUR": 20 }` - checked against
  the summed `cost` amounts of that currency, the same way and in the same
  place `maxCostUsd` is checked against `costUsd`. Nothing is converted
  and nothing is summed across units.
- **The reading that says what cannot act learns it.** A ceiling in a unit
  no stage's agent is billed in, or that no stage's agent reports, is
  reported before the run like every other dead ceiling.
- **The settings surfaces say which unit the field is in**, and where a
  ceiling in another unit is set.
- **`LIMITS.md` says which ceiling has force for which agent**, including
  that for an agent that reports nothing, the only ceilings with force are
  its own per-stage cap on its command line and a time ceiling.

## Capabilities

### Modified Capabilities

- `agentic-harness`: the chain's ceiling carries a unit, and a ceiling in
  a unit nothing reports is named before the run.

## Impact

- `packages/core`: `harness-config.ts`, `harness-config-findings.ts`,
  `harness-chain-runner.ts` and their tests.
- `packages/webui`: the run budget field's label and the line beside it.
- `LIMITS.md`.
- A changeset for `@openspec-ui/core` and `@openspec-ui/webui`, and the
  hosts that bundle them.

## Explicitly out of scope

- **Converting between units.** No exchange rate is invented here, and no
  total mixes them. Two ceilings in two units are two ceilings.
- **A unitless `budget: number`.** Rejected above, and in
  `agent-usage.ts` before this change existed.
- **Making an agent report what it does not.** Six of the ten report
  nothing; a ceiling over them is dead whatever its unit, which is what
  the finding says and what `LIMITS.md` will spell out.
- **Editing a per-currency ceiling from the settings form.** The field
  there stays the dollar one, labelled; a map of currencies belongs in the
  file until somebody needs it in the form.
