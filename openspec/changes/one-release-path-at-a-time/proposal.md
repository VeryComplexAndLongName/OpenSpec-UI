## Why

Two pushes to `main` run the release path at the same time, and it breaks.

The workflow declares no `concurrency` group at all, so every push starts
a run regardless of what is already running. On `main` those runs do not
merely duplicate work — they contend for state outside the run:

- The version pull request's branch. Two runs both try to create or
  update `changeset-release/main`; one loses, with
  `Reference does not exist`.
- The release tag. Two runs reach the tagging step for the same version,
  and the second fails on a tag that already exists.

Both happened on 2026-09-07, within the same working session, and both
looked like defects in the release path rather than what they were.

The cost has been paid twice more in a way that does not show up as a
failed run at all: merges have been deliberately spaced out by hand, one
pull request at a time, because merging two in quick succession is what
produces the race. A rule enforced by a person remembering it is not a
rule.

## What Changes

- A `concurrency` group so that one release path runs at a time.
- Runs for a pull request supersede their own earlier runs — a new push
  makes the previous one's answer irrelevant.
- Runs on `main` **queue** rather than cancel. A release halfway through
  tagging or publishing must finish; cancelling it is how a tag exists
  with no release attached to it.

## Capabilities

### Modified Capabilities

- `release-quality`: the release path runs one at a time, and a run that
  is publishing is never cancelled by a later one.

## Impact

- `.github/workflows/quality.yml`, four lines. No package changes, so no
  changeset — and the behaviour is only observable on `main`, which the
  verification accounts for.

## Explicitly out of scope

- **Cancelling in-progress `main` runs to save minutes.** That is the
  obvious use of `cancel-in-progress` and the wrong one here: the jobs
  that matter on `main` mutate state outside the run, and stopping one
  partway is worse than paying for it to finish.
- **Serialising the pull-request jobs across branches.** Two unrelated
  pull requests contend for nothing; grouping them would queue work that
  has no reason to wait.
