Reported by the owner on 2026-09-21: "Changes in this sprint" shows only
two changes.

## 1. The checklist

- [x] 1.1 `ChangeChecklist`: a row per change with a checkbox and whether
  it is archived or under way; search by every word; "Archived in the
  range, and under way", All, None; a count.
- [x] 1.2 The standalone's sprint report uses it, the changes under way
  first and the archived newest first.

## 2. Checks

- [x] 2.1 Tests: `changesInRange` and the date read from a folder; ticking
  and counting; a range, all and none; search keeping what was ticked; no
  range, no range button.
- [x] 2.2 Seen on the owner's repository: 300 changes, a week's range
  ticks 71 in one press, the list scrolls.
- [x] 2.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped. typecheck and lint pass. Tests: cli 175,
  core 1761 and 33, extension 483, server 114, webui 650 of 651. The one
  failure is `packages/webui/scripts/build-metro-icons.test.mjs`, which
  fails on Windows for its line endings and fails the same way on untouched
  `main`.
- [x] 2.4 The whole standalone browser suite passes: 28 of 28, the sprint
  report spec choosing through the checklist.
- [x] 2.5 A changeset: webui and the server, patch.
- [x] 2.6 `openspec validate the-sprint-picks-its-changes --strict`.
