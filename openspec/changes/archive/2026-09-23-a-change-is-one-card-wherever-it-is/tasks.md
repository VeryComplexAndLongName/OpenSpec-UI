Asked by the owner on 2026-09-23: why are the other working directories'
changes not on the board? It is one person working in several folders.

## 1. Where the stages come from

- [x] 1.1 The stages are read for every working directory of the
  repository and merged by name, this directory's reading first.
- [x] 1.2 A directory that cannot be read is passed over rather than
  failing the lot.
- [x] 1.3 Both hosts read them the same way, through one function.

## 2. What stands on the board

- [x] 2.1 Every active change of the repository, wherever it is worked,
  one card per change.
- [x] 2.2 A card of another directory says which directory works it and
  where it stands, and offers no action on it.
- [x] 2.3 It is not drawn a second time under the other working
  directories; that section keeps its directories, branches and runs.
- [x] 2.4 The heading becomes "Changes" on the board, and the arrangement
  by declared order keeps its own heading and its own scope.

## 3. Checks

- [x] 3.1 Tests: another directory's change on the board, once, read-only,
  named and staged; the other arrangement unchanged.
- [x] 3.2 Live, 2026-09-23: a repository with two working directories, a
  change in each, through the standalone. Both cards on the board,
  `here-at-home` in Planned with its controls and `over-there` in In
  progress saying "worked in over-there" with none; counts 0, 1, 1, 0, 0,
  0; the heading "Changes"; no second card below.
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 192, core 1883 and 57,
  extension 493, server 116, webui 661. A first run failed one server
  test, which mocked the reader the route no longer calls; the mock
  follows the route now.
- [x] 3.4 The extension's integration suite: 19 passing. The whole
  standalone browser suite: 29 of 29.
- [x] 3.5 `openspec validate a-change-is-one-card-wherever-it-is
  --strict`: valid. The merge gate locally with `--base origin/main`: ok.
- [x] 3.6 A changeset: core, webui, the server and the extension, minor.
