# Design

## Decision: one read of the log answers both questions

`/api/workspace-run-stats` already reads the audit log and the list of
changes. The quality figures need exactly those two things, so they come
back from the same call rather than from a second route reading the same
file to answer half as much.

## Decision: the same exclusion rule, shared rather than copied

Runs against a change that is neither active nor archived are excluded
here too — a deleted change was an experiment, and charging an agent for
its failures counts this project's own testing as its behaviour. The rule
moved out of `buildWorkspaceRunStats` into a function both call, because
two copies of "which runs count" drift into two answers about one log.

## Decision: a threshold, stated with the figure

Five verifying stages, the same number and the same reasoning as
`ENOUGH_RUNS`: one failure in one verify is not a rate. A group below it
is reported as thin rather than left out — omitting it would make "too
little is known" look like "this agent never fails".

## Decision: counts, not names

`checksFailed` in the audit entry is a number. An earlier draft of this
carried a "which checks failed, most frequent first" list, which the
entry cannot support — caught by reading the type rather than by
assuming it. What ships counts.

## Decision: the empty state says which empty it is

Three sentences, not one: nothing logged at all; runs logged but none
that verified; or figures. The middle one is this repository today, and a
surface that said only "no data" would leave a reader wondering whether
the feature works.
