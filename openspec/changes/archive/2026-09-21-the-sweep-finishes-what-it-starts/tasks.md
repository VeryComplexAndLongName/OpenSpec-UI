Found on 2026-09-21 while finding out why two finished changes were not
archived.

## 1. Removal

- [x] 1.1 `sweepFinishedDirectories` runs the shell removal whether or not
  `git worktree remove` succeeded, and `git worktree prune` after a git
  failure; it reports a failure only where the shell removal fails too.
- [x] 1.2 `git.ts`: `worktreePrune`.

## 2. Archive pass

- [x] 2.1 `archiveLandedChanges` fails, pushing nothing, where its commit
  committed nothing.

## 3. Checks

- [x] 3.1 Tests: a removal git gave up on is finished and pruned, with
  fakes and with real git and a real link whose target survives; a removal
  that fails both ways is reported with git's reason; an archive that
  changes nothing pushes nothing.
- [x] 3.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped. typecheck and lint pass. Tests: cli 175,
  core 1761 and 33, extension 483, server 114, webui 645 of 646. The one
  failure is `packages/webui/scripts/build-metro-icons.test.mjs`, which
  fails on Windows for its line endings and fails the same way on untouched
  `main`.
- [x] 3.3 The extension's integration suite passes: 18 passing.
- [x] 3.4 A changeset: core, the server and the extension, patch.
- [x] 3.5 `openspec validate the-sweep-finishes-what-it-starts --strict`.
