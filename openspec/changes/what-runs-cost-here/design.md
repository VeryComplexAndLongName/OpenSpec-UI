# Design

## Context

Measured 2026-09-09 from `.openspec-ui/audit.jsonl`:

| | |
| --- | --- |
| entries | 108 |
| entries against a change still in the repository | 80 |
| paired runs from those | 40 |
| runs with a recorded cost | 16 |
| runs with a recorded **effort** | **1** |

| Agent | Runs | Completed | Cost samples | Median $ | Median min |
| --- | --- | --- | --- | --- | --- |
| `claude-cli-acp` | 17 | 15 | 15 | 1.94 | 7.9 |
| `copilot-cli-acp` | 12 | 7 | 0 | — | 8.5 |
| `claude-cli` | 10 | 10 | 0 | — | 19.6 |

## Decision: a fixture is a change that no longer exists, not a flag

A run against a throwaway change must not count as evidence about the
product. The obvious answer is a marker written at run time, and it is
the wrong one: it needs a config key, its validation, and its round-trip
guard, it would only take effect for future runs, and until an aggregate
consumer existed it would be a setting nothing reads — the defect this
repository has fixed six times.

The rule needs no marker. A change that was finished is in
`openspec/changes/archive/`; one still being worked on is in
`openspec/changes/`. A change in neither was deleted, and a deleted
change is not part of this project's record.

Checked against the real log before choosing it. Of 24 changes carrying
entries, 5 are gone, and all five are experiments — three
`*-manual-smoke-2026-09-08` and two `usage-from-acp-live-<timestamp>`.
No real change was excluded and no fixture survived.

It also works backwards over every entry already written, which a marker
cannot.

## Decision: group by agent first, by effort when there is enough

A threshold of five runs per group, and the same for cost where a cost
figure is offered.

Grouped by (agent, effort) the corpus is one run. Waiting for that would
mean shipping something that says nothing for weeks while the data it
needs accumulates — and the data it already has answers a real question:
`claude-cli` takes 19.6 minutes against `claude-cli-acp`'s 7.9, and
`copilot-cli-acp` reports no cost at all, so a spending ceiling over it
cannot act.

So the aggregate is computed at both levels, each group carries its own
sample count, and a group under the threshold is reported as *under the
threshold* rather than omitted. A caller that shows nothing for a thin
group and nothing for a group that does not exist repeats the confusion
this project has drawn five times.

## Decision: the counts travel with the figures

Every group reports how many runs it rests on and how many of those
reported a cost. A median over 15 samples and a median over 2 are
different claims, and a figure that does not say which is a figure that
will be believed equally.

This is also what makes accumulation visible: a reader who sees "1 of 5
needed" knows the mechanism is working and waiting, rather than broken.

## Rejected: per-change aggregation

13 of 22 changes carrying any record have exactly one run. There is
nothing to aggregate. The change's own history stays where it is —
`buildChangeCostReport`, per change, unchanged — and this is the
workspace-level view beside it.

## Rejected: deriving ceilings here

Turning "median $1.94, p90 $7.14" into "set your ceiling to $8" is a
decision, not a measurement, and it has to account for the budget the
workspace already declares. That is the next change's argument; this one
produces the distribution it will argue from.
