---
"@openspec-ui/core": minor
---

Let `verify` send work back to `apply`. `verify` writes each declared mechanical
check's result onto its own task's checkbox, so a failing check unchecks the
task — and the chain then walked forward into `archive`, which refuses while any
task is unchecked. The machine detected unfinished work correctly and then
stopped with an error instead of finishing it.

Where `maxStageAttempts` allows another attempt, the chain now returns to `apply`
and records that verification is why, so a stage appearing twice is
distinguishable from a duplicate. Bounded by that existing counter rather than a
second ceiling, and counted per stage, so a slow `verify` cannot consume the
allowance meant for `apply`. Where the attempts are used up — or where the chain
was entered at `verify` and has no `apply` to return to — it stops and names the
tasks still unchecked, rather than only counting them.

With no attempt count configured nothing changes: `archive` refuses exactly as
before.
