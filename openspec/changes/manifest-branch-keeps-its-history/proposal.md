## Why

The manifest branch is rebuilt from nothing on every publish, and the
consumer reads it by commit.

The publish step creates a temporary directory, runs `git init`, makes
one commit, and force-pushes it as `release-manifest`
(`.github/workflows/quality.yml`, "Force-updated: only the current state
is ever read, so history on this branch serves nobody"). That reasoning
is sound from inside this repository and wrong from outside it.

Measured 2026-09-07. At 09:27 the branch held exactly one commit,
`7f84dd5`. Four hours and three releases later it held exactly one
commit again — `3e536ae`, with no ancestor in common. Every publish
replaces the branch with an unrelated history, so the commit a consumer
resolved a moment ago stops existing.

Two constraints from the site that consumes this, neither visible from
this repository:

1. **The branch must not be deleted and recreated — only pushed onto.**
   The two `404`s in the site's `homepage-sync` today fall in exactly
   the window where the branch it had a commit for was gone.
2. **The site reads the manifest at the commit in a push event's `after`
   field, not at the branch tip.** So the notification has to be an
   ordinary push to that branch. A `release` event does not carry one,
   and an `after` of the zero commit — what a branch deletion sends — is
   ignored.

There is a third mismatch, on our side of the same seam. The webhook this
repository sends states `commit: $GITHUB_SHA`, which is the commit on
`main` that triggered the release — not the manifest commit the consumer
needs. The site is being told the version of a document by pointing at a
different repository's history.

## What Changes

- The manifest is published by committing onto the existing branch:
  fetch it, add the commit, push without `--force`. The history the
  consumer resolves against stays resolvable.
- The branch is never deleted as part of publishing. Where it does not
  exist yet, it is created once; after that it only grows.
- What the repository tells the site identifies the manifest commit, not
  the commit on `main` that caused it.

## Capabilities

### Modified Capabilities

- `release-quality`: the published manifest stays retrievable at the
  commit a consumer resolved, and what the repository announces names
  the document rather than the change that produced it.

## Impact

- `.github/workflows/quality.yml`, the publish and notify steps. No
  package changes, so no changeset — but the behaviour is only observable
  on `main`, which the verification tasks account for.

## Explicitly out of scope

- **Keeping the manifest anywhere other than a branch.** A release, a
  tag, or a published package would each satisfy the consumer, and each
  is a larger change than the one the evidence calls for. What is broken
  is the rewriting, not the choice of location.
- **Pruning the branch's history.** It grows by one small commit per
  release. If that ever becomes a cost, the answer is a deliberate,
  announced prune — not an accidental one on every push.
- **Changing what the site does with the manifest.** The two constraints
  above are the consumer's, taken as given.
