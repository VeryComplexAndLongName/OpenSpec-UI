# Design

## Context

Read on 2026-09-08 from `.github/workflows/quality.yml`.

- The workflow triggers on `push` to `main` and on `pull_request`
  targeting it. There is no `concurrency` key at any level.
- Three jobs mutate state outside their own run, all gated on
  `github.event_name == 'push' && github.ref == 'refs/heads/main'`:
  `version-packages` (creates or updates the `changeset-release/main`
  pull request), `release-extension` (creates a tag and a release), and
  `release-manifest` (pushes a commit to the `release-manifest` branch).
- Observed failures, both on 2026-09-07: `Reference does not exist` from
  two runs racing on the changesets branch, and a duplicate release tag.

## Decision: group by workflow and ref

`concurrency.group` is the workflow name plus `github.ref`. Every push to
`main` lands in one group; each pull request gets its own.

Keying on the ref rather than on the workflow alone is what keeps
unrelated pull requests from queueing behind each other. They contend for
nothing — their jobs write only to their own run — so serialising them
would buy nothing and cost wall-clock on every review.

## Decision: pull requests cancel, `main` queues

`cancel-in-progress` is `true` for a pull request and `false` on `main`,
which is one expression:

```yaml
cancel-in-progress: ${{ github.ref != 'refs/heads/main' }}
```

The two halves have opposite reasons, and both matter.

**A pull request should cancel.** A new push makes the previous run's
answer irrelevant — nobody merges on a green tick for a commit that is no
longer the head. Cancelling is strictly better than paying for an answer
about a superseded commit.

**`main` must not.** The jobs there create a tag, push a branch, publish
a release. A run cancelled between tagging and releasing leaves a tag
with no release attached, which is worse than the race it would have
prevented and far harder to notice. Queueing costs a few minutes of
waiting and leaves the state consistent either way.

This asymmetry is the whole change. A single `cancel-in-progress: true`
would look like the same fix and would introduce a new failure mode on
the path that matters most.

## Decision: at the workflow level, not per job

Group the whole workflow, not `release-extension` alone.

Per-job grouping would let a second run's `quality` job start while the
first run's release jobs are still going — which is harmless in itself,
but it means two runs are in flight and the next person to reason about
the race has to hold which jobs are grouped and which are not. The
workflow is the unit a person thinks in, and the jobs that must not
overlap are all in it.

The cost is that a second push waits for a first run's tests as well as
its release steps. On a repository where a full run is under two minutes,
that is not worth a subtler rule.

## Rejected: leaving it to whoever is merging

This is what happens today: merges are spaced out by hand because merging
two in quick succession is what produces the race. It has held so far
because one person has been doing the merging and remembering the rule.

A rule enforced by memory fails on the day someone else merges, or the
day the person doing it is in a hurry — which is exactly the day two
merges land together.

## What this does not decide

Whether the release jobs should be idempotent — able to run twice against
the same version without failing. That would make the race harmless
rather than prevented, and it is a larger change to three jobs. Worth
having as well, eventually; this is the cheap half.
