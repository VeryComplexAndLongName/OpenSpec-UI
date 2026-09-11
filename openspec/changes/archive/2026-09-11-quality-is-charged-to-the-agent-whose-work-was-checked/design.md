# Design

## Decision: the entry names the agent it is about

A checks entry gains `checkedAgent`: the agent configured for the
`apply` stage of the same chain run, which is the agent whose work the
checks examined. `agent` stays `verify-checks`, because that is what
wrote the entry and the audit log records the writer. Quality groups by
`checkedAgent` and falls back to nothing: an entry without it — every one
written before this change — is counted in `entriesWithChecks` and
reported as "checks recorded before the agent was named", not charged to
a group.

The alternative — inferring the apply agent at read time from the
neighbouring entries of the same `runId` — makes the reading depend on
which entries happen to be present, and a log rotated or filtered by
change loses the inference silently.

## Decision: a checks entry is not a run

Wherever entries are paired into runs — `change-cost-report.ts`,
`workspace-run-stats.ts` — an entry whose `agent` is the checks
pseudo-agent is excluded before pairing. It is a fact about a run, not a
run. One predicate in core says which entries are runs, and every
counter uses it.

## Decision: a gap reason says which nothing it is

The cost gap distinguishes three states: no group reported a cost; one
or more reported but sit below the run threshold; one is eligible and
has nothing to compare against. The reason text names the state. This is
the same three-way honesty `describeVerifyQuality` already applies to
its own empty states.
