Asked by the owner on 2026-09-24: the Pipeline has no sorting, and a user
is about to number every change.

## 1. The order, in core

- [x] 1.1 `change-order.ts`: the three orders, their names, a comparison
  that reads digits as numbers and sets case aside, and a rank.
- [x] 1.2 The facts an order compares, from this checkout's card, the
  survey's reading, or the archive: progress, and the later of the task
  list's last change and the last run's end.
- [x] 1.3 `change-layout.ts` stacks each column by a rank where one is
  given, and by name read as numbers otherwise, in both arrangements.

## 2. The control

- [x] 2.1 A Sort control beside the arrangement: Name, Progress, Recently
  changed.
- [x] 2.2 The order reaches every picture: this checkout's, the board's
  other directories' cards and archived ones, and the other working
  directories' own pictures.
- [x] 2.3 The choice is kept with the zoom and the arrangement; an order
  the view does not know reads as Name.

## 3. Checks

- [x] 3.1 Tests: numbered names in place; each order and its ties; a card
  without the fact after the ones with it; facts from card, survey and
  archive; the layout stacking by rank in both arrangements; the control's
  options, its effect on the cards' places, the kept choice, and an
  unknown one.
- [x] 3.2 Live against this repository: each order picked, and the columns
  seen to change. 2026-09-25, the standalone built from this worktree, two
  active changes in one column: Name and Recently changed put
  the-board-sorts-its-cards first (its task list changed that morning);
  Progress put the-harness-applies-with-deepseek first, all its tasks
  done. The Sort control stands beside the arrangement.
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0. Test 0 (core 1907, server 493,
  extension 116, webui 669). The first typecheck failed on this change's own
  test, which gave the view an order its memory type rules out; cast as
  what an older store may hold, typecheck 0 and lint 0.
- [x] 3.4 The extension's integration suite, and the whole standalone
  browser suite; its regenerated Pipeline pictures kept. Integration: 19
  passing. Browser: 29 of 29. Kept `pipeline.png`, `pipeline-board.png` and
  `pipeline-stop.png`, which show the toolbar with the Sort control.
- [x] 3.5 `openspec validate the-board-sorts-its-cards --strict`, and the
  merge gate locally with `--base origin/main`. Validate: valid; the gate
  exit 0.
- [x] 3.6 A changeset: core, webui, the server and the extension, minor.
