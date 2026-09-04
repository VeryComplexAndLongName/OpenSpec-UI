One argument. The care is in choosing a number that does not have to be
revisited every few changes, and in recording what it was chosen from —
the existing comment already named the problem and was believed to have
solved it.

## 1. Apply the ceiling the comment already describes

- [x] 1.1 `packages/core/src/task-checklist.test.ts`: give the
  repository-wide parse test an explicit timeout.
- [x] 1.2 Size it for growth, not for today. The measurement to record:
  1550 ms alone at eighteen change directories, over 5000 ms under
  full-suite load. A ceiling that only just clears today's loaded figure
  would fail again within a few changes.
- [x] 1.3 Update the comment so it states what is true — the ceiling is
  applied, with the measurement behind it — rather than describing an
  intention. A comment that claims a fix the code does not have is worse
  than none: it stops the next reader from looking.

## 2. Verification

- [x] 2.1 `openspec change validate --strict task-checklist-timeout-ceiling`.
- [x] 2.2 Confirm the test still fails when its assertion is violated,
  not merely that it passes. Raising a timeout can mask a test into
  uselessness, and a green run alone would not tell the difference.
- [x] 2.3 `npm run typecheck`, `npm run lint`, `npm run test` — the full
  suite, since the failure only appears under full-suite load. Read the
  whole failing-file list: `git.push.test.ts` is intermittent here and
  has already hidden a real failure behind it twice.
- [x] 2.4 No changeset: a test's own budget, nothing published changes.
