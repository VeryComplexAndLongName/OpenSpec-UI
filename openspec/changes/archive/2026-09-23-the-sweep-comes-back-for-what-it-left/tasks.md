Asked by the owner on 2026-09-23, after a 54 MB shell sat under the
worktree root for a day: did it, cleared up after itself completely.

## 1. Whose a shell is

- [x] 1.1 A shell is this product's where it is named after a change this
  repository knows, active or archived, and holds no `.git` of its own.
- [x] 1.2 Such a shell is cleared whatever is inside it; an empty one is
  still cleared whatever it is named; anything else is reported and left.
- [x] 1.3 Links are unlinked before the walk, so a module overlay's
  junctions cannot carry a removal into the primary directory.

## 2. Who does it

- [x] 2.1 The periodic workspace sweep clears the shells itself, on the
  worktree root as this product resolves it (ADR 0027), and says what it
  removed and what is still held.
- [x] 2.2 A shell it could not remove is asked again on the next pass,
  rather than thrown or forgotten.
- [x] 2.3 The standalone's tidy button judges a shell the same way, so two
  surfaces cannot disagree about whose a directory is.

## 3. Checks

- [x] 3.1 Tests: a shell named after a change with a file in it is ours; a
  checkout of its own is not, by either spelling of `.git`; an empty shell
  nobody named is still cleared; the names a repository knows, active and
  archived; and the sweep end to end against real git.
- [x] 3.2 Live, 2026-09-23: against the real worktree root
  `C:\Prog\.worktrees\OpenSpec-UI`, 320 change names known, 2 live working
  directories, with a shell of the archived `a-change-knows-its-stage`
  planted holding a file under `.vscode-test`. Read as `empty=false
  ours=true`, removed, nothing kept, no failure, and neither live working
  directory touched.
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 192, core 1857 and 54,
  extension 493, server 116, webui 655.
- [x] 3.4 The extension's integration suite: 19 passing. The whole
  standalone browser suite: 29 of 29 in 8.0 minutes. A first run on a
  loaded machine took 15.7 minutes and missed two waits; each of those
  two passed on its own, and the whole suite passed again.
- [x] 3.5 `openspec validate the-sweep-comes-back-for-what-it-left
  --strict`, and the merge gate locally with `--base origin/main`.
- [x] 3.6 A changeset: core and the server, minor.
