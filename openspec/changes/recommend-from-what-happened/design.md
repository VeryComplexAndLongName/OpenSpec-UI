# Design

## Context

What the aggregate says about this repository on 2026-09-09:

| Agent | Runs | Completed | Cost samples | Median $ | Median min |
| --- | --- | --- | --- | --- | --- |
| `claude-cli-acp` | 18 | 16 | 16 | 1.88 | 7.7 |
| `copilot-cli-acp` | 12 | 7 | 0 | — | 5.9 |
| `claude-cli` | 10 | 10 | 0 | — | 18.9 |

## Decision: a recommendation is named for what it recommends

"Cheapest", "fastest", "most likely to finish" — not a fixed set of
intents chosen in advance. The name is the conclusion, and the
observation it was drawn from stands beside it.

This is the difference from the named configurations, which are decided
before any workspace exists and are therefore titled by what they are
*for*. These are decided by the workspace and are titled by what they
*are*.

## Decision: a recommendation exists only where its answer is separable

"Cheapest" needs at least two agents that reported a cost. With one, the
cheapest and the most expensive are the same row and the word means
nothing.

So each recommendation states its own precondition, and where the
precondition fails it is not offered. On this repository today that means
**cheapest is not offered at all** — one agent of three reports a cost —
which is the honest state of it and would otherwise be a recommendation
of the only option, dressed as a comparison.

## Decision: ties are reported, not broken

Where two groups are equal on the measure, both are named. Picking one
arbitrarily and presenting it as the answer is a fabricated distinction,
and this project has spent six changes on the difference between a figure
that was measured and one that was produced.

## Decision: the threshold is the aggregate's own

A group below `ENOUGH_RUNS` does not become a recommendation. The
aggregate already marks such a group; letting it win a superlative would
make five runs and two runs equally authoritative in the one place where
the number is stated as an answer rather than as a reading.

## Rejected: a single "recommended" answer

Combining cost, speed and completion into one score needs weights, and
there is nothing to draw them from. A person choosing between "cheapest"
and "fastest" is making a trade only they can make; naming both and
saying what each costs is the help that can honestly be given.

## Rejected: recommending an effort

The obvious next axis, and the corpus is one run in forty. It will become
possible; today it would be a superlative over a single observation.
