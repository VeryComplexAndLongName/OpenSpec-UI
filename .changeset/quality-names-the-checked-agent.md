---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
---

What a verifying stage's checks found is now charged to the agent whose
work they covered. The entry gains `checkedAgent`, taken from the chain's
resolved `apply` stage, and the quality readback groups by it — grouping
by the entry's `agent` could only ever produce one row, named
`verify-checks`, whatever had run the apply. An entry recorded before
that field existed is counted and reported as such rather than charged to
a group.

A checks entry is also no longer counted as a run. It carries a terminal
outcome and no `started` partner, so the per-change cost report listed it
as a run refused before it started and one chain run of apply and verify
reported two previous runs; one predicate in core now says which entries
are runs, and both counters use it. A checks entry therefore no longer
appears as a row in the per-change cost report — what it found is read
back beside the run figures instead.

A recommendation's gap says which nothing it is: nothing reported the
measure, something reported it but rests on too few runs, or one
candidate is eligible with nothing to compare against. Four runs that
each reported a cost previously read as "no agent has reported a cost
across 4 recorded run(s)".
