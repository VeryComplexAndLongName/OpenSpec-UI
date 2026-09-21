## Context

Three ceilings exist today, in two places:

- `stepAgents.<stage>.budget` - `maxCostUsd` or `maxAiCredits`, validated
  against the agent's own `budgetField` and passed to its command line.
  This one already has a unit.
- `budget.maxCostUsd` / `budget.maxTokens` - the chain's, checked in
  `harness-chain-runner.ts` against usage summed from the audit before
  each stage.
- `budget.maxStageCostUsd` / `maxStageTokens` - the same, against one
  stage's own report when it ends.

`AgentUsage` carries `costUsd?: number` and, separately,
`cost?: { amount: number; currency: string }`. The second is written by
the ACP adapters from ACP's `Cost` and read by nothing.

`findHarnessConfigLimits` reports, before a run, every ceiling that cannot
act on a stage, from the agent's `reports` field.

## Goals / Non-Goals

**Goals:**

- A chain running on credits can have a chain ceiling.
- No total mixes units, and no rate is invented.
- A ceiling nobody can check is named before the run, not after the bill.

**Non-Goals:**

- A single number that means whatever the agent bills in.
- Reading a currency out of `maxAiCredits`: that field is a command-line
  argument for one agent, not a record of what was spent.

## Decisions

### `budget.maxCost` is a map from currency to ceiling

`{ "credits": 500 }` rather than a second scalar field per unit. A scalar
per unit means a new field, a new validator and a new check every time a
vendor bills in something else; a map means the currency is data, and the
check is written once.

`credits` is a currency code here in the same sense `USD` is: the string
the agent reported. The check compares like with like and never sums
across codes.

**Rejected: `maxAiCredits` at chain level.** It would read as the twin of
the per-stage field, which is a command-line flag for two named agents,
and it would need another field for the next unit.

**Rejected: folding USD into the map.** `maxCostUsd` is in every
configuration, every template and both settings forms. Moving it would be
churn with no gain; the map holds what the scalar cannot.

### A ceiling is checked only against what was reported in its unit

The chain sums `usage.cost.amount` per currency, as it already sums
`costUsd`, and compares each configured ceiling against its own currency's
total. A stage reporting `{ amount: 12, currency: "credits" }` counts
towards `maxCost.credits` and towards nothing else.

### A ceiling in a unit nothing here is billed in is a finding

The existing reading gains one rule: for each currency in `maxCost`, if no
stage's agent is billed in that unit - `budgetField` says which unit an
agent's own cap is in - or if the agents billed in it report nothing, say
so. The wording follows the findings already there: what cannot happen,
and which ceiling can.

**Rejected: refusing the configuration.** The existing requirement settles
this: an operator may knowingly set a ceiling that binds some stages and
not others.

## Risks / Trade-offs

- **A currency code is free text.** `Credits` and `credits` would be two
  ceilings. The check folds case when it compares, and the finding names
  what it found.
- **A map is harder to edit by hand than a number.** It is edited in the
  file by somebody who already knows their agent bills in credits; the
  form keeps the dollar field it has.
- **Two ceilings can both be configured and only one act.** That is the
  point of the finding, and it is reported before the run.
