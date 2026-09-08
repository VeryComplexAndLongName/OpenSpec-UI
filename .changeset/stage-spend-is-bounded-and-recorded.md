---
"@openspec-ui/core": minor
---

Record what each stage spent, and bound it. An audit entry now carries the
`stage` it belongs to and the `effort` the agent was asked for, so a report built
from the log can break a change down stage by stage — every stage of a chain runs
under the chain's own run id, so nothing else in the record could say which stage
spent what. Both fields are optional and absent for a single-stage run, and an
entry written before them is never given a stage after the fact.

`budget.maxStageCostUsd` and `budget.maxStageTokens` bound one stage, enforced
here rather than by the agent's own command line — which offers a spending flag
for two of the ten supported agents. Checked when a stage ends and stopping the
chain rather than the stage, because a run's cost is not known until it ends:
this prevents the next overspend, not the one that happened. Neither may exceed
its whole-chain counterpart, which would stop the run first.

A run stopped by a ceiling now records the reason on the single entry it already
writes, rather than a second one, so a finished run can be told from one a person
cancelled.
