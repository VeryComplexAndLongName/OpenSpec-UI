## Why

`main` requires a pull request's checks to have passed on a branch that is
up to date with it. Keeping that true by hand is what this repository
actually spends its afternoons on: the checks take about seven minutes,
the article campaign lands several small pull requests inside that
window, and a branch is stale again before it is green. On 2026-09-20 the
owner said "out-of-date" five times, and the same pull request went stale
three times in one hour.

The answer chosen first was GitHub's merge queue, and it is the right
answer: it updates each entry against the tip, checks the tentative
merge, and lands it. `the-merge-queue-lands-them-in-order` shipped the
half that has to come first - the `merge_group` trigger - and then the
queue could not be turned on.

**A merge queue is a feature of repositories owned by an organization.**
This one is owned by a user account. The API refuses the `merge_queue`
rule outright, with no parameters, in a fresh disabled ruleset: not a
setting to get right, a feature that is not there.

So the choice is between the rule and the churn, and the owner chose to
drop the rule on 2026-09-20.

## What Changes

- **`main` no longer requires a branch to be up to date.** The ruleset's
  `strict_required_status_checks_policy` goes to `false`. Every required
  check stays required, and a pull request still cannot land red.
- **The merge queue work is withdrawn,** rather than left as dead
  configuration describing something that cannot happen: `quality.yml`
  loses the `merge_group` trigger and goes back to what it was, the
  runbook loses the paragraph about joining a queue, and
  `openspec/changes/the-merge-queue-lands-them-in-order/` is removed. Its
  spec deltas were never applied, so no specification carries the queue.
- **The runbook says what is true instead:** nobody updates a branch for
  "out-of-date" any more, because nothing asks them to; a rebase is for a
  conflict.
- **What the dropped rule guarded is written down** in the runbook, so
  the risk is a known one rather than a forgotten one: two pull requests
  that are green apart can be broken together, and git catches only the
  textual half of that.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `release-quality` - what `main` requires of a branch before it merges.

## Impact

- `.github/workflows/quality.yml` (back to its state before #640),
  `openspec/README.md`, and the removal of the withdrawn change's
  directory.
- The `main` ruleset: one parameter, recorded here and read back.
- No `packages/*` change and no changeset.

## Explicitly out of scope

- **Moving the repository to an organization.** That would make the queue
  available, and it changes the owner, the URL and every publishing
  credential. It is a decision with an ADR, not a side effect of a CI
  annoyance.
- **Reducing what is checked.** Nothing is dropped from the required
  checks. This changes when they must have run, not what they are.
- **Making an agent merge.** The owner merges.
