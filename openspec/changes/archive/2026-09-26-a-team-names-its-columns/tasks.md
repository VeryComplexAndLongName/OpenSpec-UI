Asked by a user on 2026-09-24, agreed with the owner on 2026-09-25: a
board in the team's own columns, mapped onto the stages.

## 1. The decision

- [x] 1.1 ADR 0037 amended: `openspec/board.json`; a column is a view of
  stages; every stage once, in order, never split; refused whole.

## 2. Core

- [x] 2.1 `parseBoardColumns`: the columns, or why the file is refused, in
  the file's own words.
- [x] 2.2 `readBoardColumns`: none without the file, the reading with it.
- [x] 2.3 `layoutChangesByStage` takes the columns: each card where its
  stage is, a column headed by its title and drawn as its first stage.

## 3. The hosts and the board

- [x] 3.1 `POST /api/board-columns`, and `pipeline/board-columns` in the
  editor's panel, from the host's own root.
- [x] 3.2 The board draws the team's columns; where the file is refused, a
  column per stage and a line saying why.
- [x] 3.3 `docs/how-to/name-the-board-columns.md`.

## 4. Checks

- [x] 4.1 Tests: the rules each broken once and said; the columns read and
  the layout by them; the file read, absent and refused; the route and the
  panel's operation; the board drawn in the team's columns, and refused.
- [x] 4.2 Live, in the standalone and in the editor: a `board.json` joining
  stages, and the board in its columns; a broken one, and the line saying
  why. 2026-09-26, this worktree with the how-to's five columns written for
  the check and removed after it. Standalone: the board headed BACKLOG,
  READY, DOING, REVIEW, DONE, counting 5 in Doing and 7 in Done, Landed and
  Archived together; the file rewritten without "archived" and refreshed,
  the board went back to its seven stages and said "openspec/board.json is
  not used: No column holds "archived": its cards would stand nowhere.".
  Editor, the Extension Development Host built from this worktree: the same
  five columns.
- [x] 4.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Typecheck 0, lint 0, test 0
  (core 1925, server 497, extension 118, webui 675).
- [x] 4.4 The extension's integration suite, and the whole standalone
  browser suite. Browser: 29 of 29; its fixtures carry no board.json, and
  the regenerated pictures were left out. Integration: 19 passing, on the
  second run; the first never reached a test, the editor started as Node
  because ELECTRON_RUN_AS_NODE had reached it from this session.
- [x] 4.5 `openspec validate a-team-names-its-columns --strict`, and the
  merge gate locally with `--base origin/main`. Validate: valid; the gate
  exit 0.
- [x] 4.6 A changeset: core, webui, the server and the extension, minor.
