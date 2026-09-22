## Why

ADR 0036 promised that the product finishes what it starts, whatever the
repository's settings. On 2026-09-22 a gap in that promise showed up.

- The sweep's archive branch is not a working directory, so the pass that
  rebases behind branches (ADR 0034) never sees it.
- Many repositories merge only what is up to date with the default
  branch:
  - GitHub's "require branches to be up to date";
  - GitLab's fast-forward merge;
  - Gitea's "block merge on an outdated branch".
- In such a repository, once another pull request lands, the forge refuses
  the archive pull request. It refuses it again on every pass after, and
  the sweep would say so every five minutes for good.

This repository does not require it today (`strict: false`). Other
repositories do.

## What Changes

- **A refused archive is made again on the default branch** when both
  hold:
  - the forge refused the merge;
  - the default branch has moved on past the archive's branch.

  The archive is mechanical, so `openspec archive` runs again on the
  default branch as it is now, for the changes that are due. The sweep
  moves its own branch there with a lease: a push somebody else made
  meanwhile refuses this one. The checks run again, and the next pass
  follows them.
- **A new outcome, `rebuilt`**, is said as "#N was refused while K commits
  behind the default branch, so the archive was made again on it and
  pushed; its checks run again". A host re-sweeps sooner for it, as for
  any archive pull request still open.
- **A blocked outcome names its cause**: a failed check, checks that could
  not be read, or the forge's refusal. Only a refusal can lead to a
  rebuild.
- Making an archive is one function, shared by opening and rebuilding.
- ADR 0036 decision 3 carries the amendment, and `HARNESS.md` says it.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - the product merges its archive pull request, and
  keeps it up with the default branch.

## Impact

- `packages/core/src/landed-archive.ts` and its tests.
- `docs/adr/0036-the-product-merges-what-it-archives.md`, `HARNESS.md`.
- A changeset: core, the server and the extension, patch.

## Explicitly out of scope

- **A refusal for any other reason**, such as an approval or a protected
  branch. It is still reported and never worked around.
- **A default branch that has not moved.** Nothing is rebuilt then, since
  the refusal is not about being behind.
