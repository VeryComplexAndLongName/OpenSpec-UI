The #549 run's failure of 2026-09-17, in a test the change did not touch.

## 1. The test

- [x] 1.1 `packages/core/src/stop-boundary.test.ts`, "ends the run when a
  task is ticked, read on the check interval": the final wait advances the
  fake clock one check interval on each attempt, with a stated wait budget
  and a comment saying why.

## 2. Checks

- [x] 2.1 `openspec validate the-stop-boundary-test-moves-its-clock --strict`
  passes.
- [x] 2.2 The test file passes five runs in a row.
- [x] 2.3 `npm run verify` passes, run unpiped. Record each package's count.
- [x] 2.4 `lint:english` after `git add`, `lint:test-budgets` and
  `lint:source-text` pass.

  Record, 2026-09-17: `openspec validate --strict` valid. The test file
  passed five runs in a row (8 of 8 each). The lost wake was not reproduced
  on this machine, where the first read always finishes before the second
  tick; the fix is read from the mechanism and #549's failing run
  (35186417043, 1061 ms, `expected +0 to be 1`). `npm run verify`, unpiped:
  typecheck and lint pass in every workspace; tests — cli 161, core 1487 + 4,
  extension 381, server 103, webui 561 of 562, the one failure being the
  known Windows line-ending comparison in `scripts/build-metro-icons.test.mjs`.
  `lint:english` (after `git add`), `lint:test-budgets` and
  `lint:source-text` pass, as part of verify's lint.
