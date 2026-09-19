Asked for by the owner on 2026-09-19, after 175 local and 40 remote dead
branches were swept by hand.

## 1. The rule is written where the process lives

- [x] 1.1 `openspec/README.md` gains `### A branch ends with its pull
  request` under **Change Governance**, after the section on what a change
  follows and before the ADR section.
- [x] 1.2 It states: one change is one pull request; the pull request's
  title is the change id, verbatim; archiving is a second pull request per
  change, titled `<change-id> (archive)`; anything left to finish is a new
  change and a new pull request.
- [x] 1.3 It says what happens when the pull request merges: the branch is
  deleted locally and on the server, its working directory is removed, and
  the empty shell `git worktree remove` leaves on Windows goes with it.
- [x] 1.4 It says why a merged branch is not detected as finished by git
  here - the repository squashes - and names the repository setting that
  deletes the head branch on the server by itself.
- [x] 1.5 It says that a commit pushed to a branch whose pull request has
  merged is stranded.

## 2. The guard holds where there is something to reach

- [x] 2.1 `packages/core/src/spec-delta-check.test.ts` asks for a delta
  spec only over the active changes that have one to give: a change whose
  own `.openspec.yaml` says `skip_specs: true` declares that it has none,
  and a queue holding only those is an empty subject, not a broken reach.

  Found on 2026-09-19 by this change's own pull request: once the change it
  rebased onto had archived everything else, this documentation change was
  the only active one, and the guard failed with "expected 0 to be greater
  than 0". Nothing was broken; the check simply had nothing to reach.

- [x] 2.2 The reading answers `false` for metadata that cannot be read or
  does not parse, so a broken file is never taken for a declaration.

## 3. Checks

- [x] 3.1 `npm run lint` after `git add`, with `lint:english` among it.

  Done 2026-09-19: every lint in the workspace green - `lint:english`,
  `lint:source-text`, `lint:changesets`, `lint:screenshots` (43 pictures),
  `lint:test-budgets`, `lint:openspec-config` and
  `lint:publish-workflow`.
- [x] 3.2 No changeset: nothing under `packages/` changes.
