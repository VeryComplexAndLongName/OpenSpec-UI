# Design

## Context

Read on 2026-09-07 from `.github/workflows/quality.yml`.

- The publish step builds the commit in a scratch repository: `mktemp -d`,
  `git init`, `git checkout -b release-manifest`, one `git add`, one
  `git commit`, then `git push --force`. Nothing fetches the branch that
  already exists, so the new commit has no parent.
- The comment above the push states the reasoning: "only the current
  state is ever read, so history on this branch serves nobody."
- The step is gated on `steps.publish.outputs.published == 'true'`, which
  compares the `id@version` fingerprint, so a push to `main` that
  released nothing publishes nothing. That part is right and stays.
- The notify step signs and sends
  `{repository, commit: $GITHUB_SHA, manifest: "releases.json"}`.
  `GITHUB_SHA` is the `main` commit that triggered the workflow.

Measured the same day: the branch held `7f84dd5` at 09:27 and `3e536ae`
at 13:04, one commit each, unrelated.

## The belief that was wrong, and why it looked right

"Only the current state is ever read" is true of the *document*. It is
not true of the *commit*. A consumer that resolves a ref to a commit and
then fetches by that commit is reading current state — it just needs the
commit it resolved to survive long enough to fetch it.

This is the kind of assumption that holds until someone else's system
depends on it, and it cannot be checked from inside this repository: the
workflow's own view is that it published a correct document, which it
did. The failure is visible only where the two systems meet, which is why
the constraints were stated by the consumer rather than discovered here.

## Decision: commit onto the branch, push without force

Fetch `release-manifest`, add a commit on top of it, push normally.

Force is not merely unnecessary here — it is the mechanism of the defect.
A normal push also fails loudly if two publishes race, which is the
correct outcome: two workflows disagreeing about the current version
should not be resolved by whichever finished last.

Where the branch does not exist yet — a fresh repository, or the first
run after this lands — it is created once, and after that it only grows.

### Why not shallow-fetch and amend

An amend still replaces the commit a consumer may hold. It would trade a
rewritten branch for a rewritten commit, which is the same failure with
a smaller diff.

## Decision: the announcement names the manifest commit

The notification exists to tell the site that a specific document is
ready. The identifier it carries must therefore be the commit the
document is in — the one the publish step just made on
`release-manifest` — not the commit on `main` that caused the release.

Those are different histories. Pointing at the second and asking the site
to fetch the first works only because the site currently falls back to
the branch tip; it stops working the moment it does what it says it does,
and it is wrong on its face today.

## Decision: a normal push is the event

The consumer reads `after` from a push event. That is satisfied by
pushing a commit and nothing else — no release, no tag, no deletion.

Worth stating because it constrains a plausible future change: replacing
the branch with a GitHub Release, or publishing via the API in a way that
does not produce a push, would silently stop the site updating while
every check here stayed green. If the location ever moves, the consumer's
trigger moves with it, deliberately.

## Rejected: keeping force-push and telling the consumer to re-resolve

It would work, and it puts the cost on the wrong side. The consumer would
have to treat every `404` as "possibly a rewrite, retry" — which is
indistinguishable from a genuine outage, and turns a correctness problem
here into an unreliable heuristic there.

## What this does not decide

Whether the publish step should verify, after pushing, that the manifest
is retrievable at the commit it just announced. That would catch this
class of failure from the producing side rather than from the consumer's
logs, and it is a check with its own cost and its own failure modes —
including how long to wait for a CDN. Worth arguing separately.
