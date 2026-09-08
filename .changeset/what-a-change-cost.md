---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
---

Read back what a change cost. A new command — **Show What This Change Cost** —
reports, for any change in either the Changes or Archive tree, a row per run with
the stage, agent, effort, outcome, reported spend and duration, plus a total. It
is offered whether the change finished or not: a change whose run was cut or
failed is where the question is most pressing, and the live usage panel cannot
answer it because the panel is gone once the run ends.

Duration comes from records already written — a run writes a `started` and a
terminal entry, both timestamped — paired in order rather than by key, so a stage
sent back by `verify` produces two rows with two durations rather than one wrong
one.

Two things are deliberately not tidied. A figure the agent never reported shows
as *not reported*, never as `$0.00`, and the total says it covers only what was
reported: most supported agents report nothing, and showing them as free would be
wrong where a reader is least able to check. A record too old to name its stage
appears as *unattributed* and is still counted — dropping it would make the total
wrong, and guessing a stage would make a row wrong.
