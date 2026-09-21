Agreed with the owner on 2026-09-21: done changes are archived and
merged automatically, and shown only in the archive.

## 1. The decision

- [x] 1.1 ADR 0035, listed in `docs/adr/README.md`.

## 2. Core

- [x] 2.1 `archive.whenLanded` in the harness config: validated, merged
  key by key, and read by `archivesWhenLanded` (absent means on).
- [x] 2.2 `Forge` and `createGitHubForge`: pull requests by branch, a new
  pull request with a title and body, and an automatic merge that tries
  squash, merge and rebase in turn.
- [x] 2.3 `git.ts`: `stagePath`, `deleteBranch`.
- [x] 2.4 `archiveLandedChanges`: finished changes read from the default
  branch, one pull request per pass, a wait while one is open, changes
  that landed owing named, and everything it made removed.
- [x] 2.5 `sweepWorkspace` runs the pass whenever the workspace has a
  remote, and `describeWorkspaceSweep` says what it did.

## 3. Hosts

- [x] 3.1 The editor: a notification for an opened archive pull request,
  and a warning once a session for a change that landed owing something.
- [x] 3.2 The standalone says the same lines under "Done for you", through
  the sweep endpoint, with no change of its own.

## 4. Documentation

- [x] 4.1 `HARNESS.md`: the `archive` key, the second exception to the
  push rule, and where it is edited. `README.md` and `openspec/README.md`:
  archiving is the product's job.
- [x] 4.2 The harness JSON schemas know 4 of 13 top-level keys and forbid
  the rest. **Deferred:** its own defect, found here; moved to
  `openspec/deferred.md`.

## 5. Checks

- [x] 5.1 Tests: the pass against a bare remote (two archived in one
  branch, a change in review, an open archive pull request, a change that
  landed owing, a change kept live, one failing archive, a forge that
  cannot be asked, a forge that will not merge, a refused push, the sweep
  with no working directory, the sweep turned off), 11 in
  `landed-archive.test.ts`; the GitHub forge's merge methods and its pull
  request, 4 in `gh-pr-gateway.test.ts`; and the config key, 4 in
  `harness-config.test.ts`. The forge and `openspec archive` are seams in
  every test, so none needs `gh` or the CLI.
- [x] 5.2 `npm run typecheck && npm run lint && npm run test` at the
  root, after `git add`, run unpiped. typecheck and lint pass. Tests:
  cli 175, core 1751 and 31, extension 474, server 112, webui 639 of
  640. The one failure is `packages/webui/scripts/build-metro-icons.test.mjs`,
  which fails on Windows for its line endings and fails the same way on
  untouched `main`.
- [x] 5.3 The whole standalone browser suite passes: 27 of 27.
- [x] 5.4 The extension's integration suite passes: 18 passing.
- [x] 5.5 A changeset: core and the extension, minor.
- [x] 5.6 `openspec validate a-landed-change-is-archived-for-you --strict`.
- [x] 5.7 The first real pass on this repository: a finished change is
  archived in a pull request the sweep opened, and it merges on green.
  Run on 2026-09-21 from this branch's code over the owner's repository,
  with the real `gh` and openspec CLI: the pass alone, not the whole
  sweep. It found `the-product-is-called-openspec-workbench` and
  `the-sprint-report-reads-like-the-timeline` due, opened #663 on
  `archive-landed-2026-09-21-123326` with both archived and their spec
  deltas applied (14 files), and asked for a squash merge. Nothing of the
  pass was left on the machine. #663 merged by itself at 12:40 UTC once
  every check had passed.
