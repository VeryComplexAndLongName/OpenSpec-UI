---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
---

A new ceiling, `budget.maxContextShare`: how much of its context window a
run may fill, as a share between 0 and 1. It reads ACP's `usage_update`,
which arrives during a stage, so unlike every spending ceiling it stops a
stage that is already running - ending the run as cancelled, with the
ceiling, its value and the reading all named. A value outside that range
is refused where the configuration resolves.

The figure is still not counted as a spend: it falls after a compaction,
so counting it as consumption would under-count exactly the long runs
that compact. What it says is that the conversation has outgrown the
task, and every further turn carries the whole of it again.

This matters most where nothing else can act. `deepseek-cli-acp` reports
no cost, no credits and no token split, so before this only `timeout`
bounded it at all. Agent capabilities now record `contextGauge` beside
`reports` - a different question, answered from evidence - and the
settings surfaces say before a run when this ceiling cannot act, and stop
calling a stage unbounded when it can.
