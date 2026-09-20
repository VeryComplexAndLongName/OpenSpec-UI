## Why

`main` requires a pull request's checks to have passed on a branch that is
up to date with it. That rule is right - what lands is what was checked -
and it has become the single largest cost of landing anything here.

On 2026-09-20 the owner had to say "this branch is out-of-date" five
times. The shape of it is always the same: a pull request's checks take
about seven minutes, the article campaign lands three small pull requests
in that window, and by the time the checks are green the branch is stale
again. The only remedy today is a person noticing, an agent rebasing, and
seven more minutes - during which the same thing can happen again.

GitHub has a merge queue for exactly this. It takes the pull requests that
are ready, updates each against the tip in turn, runs the required checks
on that tentative merge, and lands the ones that pass. Nobody rebases, and
what lands is still what was checked - checked against the very commit it
lands on, which a rebase only approximates.

The owner chose it on 2026-09-20, over dropping the up-to-date rule and
over carrying on by hand.

## What Changes

- **`quality.yml` runs in the queue.** It gains the `merge_group` trigger,
  and the five required checks - quality, the merge gate, the extension
  suite, the browser suite and the dependency audit - run on a queue entry
  as they run on a pull request.
- **A queue entry's run is never cancelled.** The concurrency rule says so
  by the event rather than by the ref: cancelling a queue entry takes the
  pull request out of the queue.
- **The version pull request's own job stays a pull request's.** In a
  queue entry there is no head branch to recognise it by, so it is skipped
  there, and the ordinary checks run on it instead.
- **The queue itself is enabled on the `main` ruleset,** after this
  workflow is on `main` - in the other order the queue would wait for
  checks that never report and every entry would time out.
- The runbook says how a change lands now: it joins the queue, and nobody
  updates a branch by hand.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `release-quality` - what runs on which event, and what "up to date"
  means now.

## Impact

- `.github/workflows/quality.yml`, `openspec/README.md`.
- The `main` ruleset gains a `merge_queue` rule. That is repository
  configuration, not a file, and this change records what it is set to.
- No `packages/*` change and no changeset.

## Explicitly out of scope

- **Dropping the up-to-date rule.** It is what the queue exists to keep.
- **Checking only in the queue.** A pull request keeps its own checks, so
  that a broken change is seen before it asks to land rather than after it
  has taken a queue slot. The cost is stated in the design: a change is
  checked twice, and batching is what keeps that from being twice the
  minutes.
- **The dependency review job.** It reads a pull request's own diff and
  has no meaning on a merge group, so it stays where it is. It is not a
  required check.
- **Teaching agents to merge.** The owner merges. A queue changes what
  happens after they press it, not who presses it.
