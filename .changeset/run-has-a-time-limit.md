---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
"@openspec-ui/server": patch
---

Bound a harness run in time. `timeout.maxRunSeconds` and
`timeout.maxStageSeconds` cap a whole chain and a single stage, both optional and
absent-means-unbounded, settable globally and per change.

Unlike a spending ceiling, this one stops a stage that is already running:
elapsed time is known during a run where a run's cost is not. It is also the only
ceiling with any force over an agent that reports no usage — six of the ten
supported report nothing, and no ceiling of any kind was in force over them
before. Time counts while a stage runs and not while the chain waits at a
checkpoint, so a person deliberating is never charged for it.

Reaching a ceiling ends the run as *cancelled* with a reason naming the ceiling
and its value, rather than as a failure: `CancelledEvent` gains an optional
`reason`, and an absent one keeps meaning "a person asked". `maxStageAttempts`
allows a cut stage to be attempted again — one number covering every reason a
stage is retried, with each attempt recording why the previous one ended. A stage
that failed on its own merits is not retried. The usage summary gains an
elapsed-against-ceiling row and shows which attempt a stage is on.
