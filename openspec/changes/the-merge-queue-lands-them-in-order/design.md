## The order the two halves have to be done in

The workflow first, the ruleset second.

A merge queue holds each entry until the required checks report on the
merge group's own ref. A queue turned on while `quality.yml` still
answers only to `pull_request` would hold every entry until the response
timeout and then drop it, which looks exactly like the repository being
broken. So the trigger lands on `main` first, and the ruleset rule is
added after - recorded as a task rather than left to memory.

## What a queue entry runs

The five required checks, the same five a pull request runs:

- Typecheck, lint, test, and build
- OpenSpec change validation (merge gate)
- Extension integration and package
- Standalone browser and accessibility
- Dependency audit

The sixth required check, "Version pull request installs, builds and
packages", is skipped in a queue entry, and a check skipped by its own
condition already satisfies the rule.

Dependency review is not required and does not run: the action reads a
pull request's own diff, and a merge group is not a pull request.

## Why the version pull request loses its special case in the queue

`version-pr` recognises itself by `github.head_ref ==
'changeset-release/main'`. A merge group has no head branch of its own,
so that test cannot be made in the queue. Rather than inferring the pull
request from the merge commit's message - a string this repository does
not control - the version pull request's queue entry simply runs the
ordinary checks. It pays the suites it skips on its own pull request,
once per release, on a change that touches versions and changelogs. That
is a few minutes a week, and the alternative is parsing a commit message
to decide what to check.

## The cost, stated

A change is now checked twice: once on its pull request, once in the
queue. The 2026-09-17 change cut four runs per change to one, and this
puts one back.

It buys the runs back with batching. The queue is set to take up to five
entries at a time and to wait a minute before starting a group, so the
article campaign's three small pull requests are one queue run rather
than three. The settings:

- `merge_method: squash` - what this repository already merges with.
- `max_entries_to_build: 5`, `max_entries_to_merge: 5` - one group for a
  burst.
- `min_entries_to_merge: 1` with `min_entries_to_merge_wait_minutes: 1` -
  a lone pull request does not wait for company.
- `grouping_strategy: ALLGREEN` - a group lands only if every entry in it
  is green, rather than landing the prefix before the first failure. With
  batches this small, the simpler rule is the one that cannot half-land a
  burst.
- `check_response_timeout_minutes: 60` - the browser suite takes about
  five minutes and the group runs them in parallel; an hour is the margin
  for a queued runner, not an expectation.

## Why not the two alternatives

**Drop the up-to-date rule.** One line, and it ends the churn by ending
the guarantee: a pull request checked against a week-old `main` could
land. The rule exists because that has bitten this repository before.

**Carry on rebasing.** It works, and it costs a person noticing every
time. On 2026-09-20 the same pull request went stale three times in an
hour; the sixth "out-of-date" is the one that gets a rule turned off in
frustration rather than on purpose.

## What does not change

Who merges. The queue is what happens after the owner presses the button:
the pull request joins the queue instead of merging at once, and lands
when its entry is green.
