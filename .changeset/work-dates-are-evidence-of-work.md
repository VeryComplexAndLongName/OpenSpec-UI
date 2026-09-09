---
"@openspec-ui/core": patch
---

Date a change's work by what was finished, not by what was written.

`firstWorked` and `lastWorked` came from every blame date on `tasks.md`.
That file is added by the same commit that adds `proposal.md`, so the
earliest of those dates *is* the proposal date — measured across 185
changes the day after it shipped, the span from proposed to first worked
was exactly zero for every one of them. It also made the audit log
unreachable, since a run always happens after the file exists and the
earliest evidence wins.

Evidence of work is now a ticked task or a recorded run. The same
measurement gives p90 0.18d and max 2.06d, and a change whose task list
is written but untouched reports no work dates at all rather than the
day the file was written.
