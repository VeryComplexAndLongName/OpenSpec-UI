Reported by the owner on 2026-09-23: pressing "By step" and "By stage"
changes nothing. Reproduced against his own checkout the same hour.

## 1. The board

- [x] 1.1 Drawn whenever it is chosen, with every column headed and
  empty, rather than replaced by a note when nothing stands on it.
- [x] 1.2 A board with nothing on it says why: no active changes, or
  nothing matching the filter.
- [x] 1.3 What landed stands in the Landed column. The fold stays in the
  other arrangement, where landing is not a place.
- [x] 1.4 An empty board has room to be seen: at least the heading strip
  and a card's worth beneath it.

## 2. What a card calls a place

- [x] 2.1 A card naming another directory that holds the same change
  calls the main checkout the main working directory. Its own heading
  keeps its own label.

## 3. Checks

- [x] 3.1 Tests: the empty board draws six columns and says why; a landed
  change stands in its column; the layout's own height; the main checkout
  named on a foreign card, with that directory's heading unchanged.
- [x] 3.2 Live, 2026-09-23: the standalone against this repository, whose
  active changes had all landed and been archived. Before: pressing "By
  stage" left the lanes as "Step 1 - can start now" and drew no board.
  After: six columns - Proposed, Planned, In progress, In review, Landed,
  Archived - and the line "No active changes on branch main: every column
  is empty."
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0: cli 192, core 1883 and 54,
  extension 493, server 116, webui 657.
- [x] 3.4 The extension's integration suite: 19 passing. The whole
  standalone browser suite: 29 of 29 in 7.3 minutes.
- [x] 3.5 `openspec validate the-board-is-of-every-change --strict`: valid.
  The merge gate locally with `--base origin/main`: ok.
- [x] 3.6 A changeset: core, webui, the server and the extension, patch.
