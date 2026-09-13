Two things the Pipeline tab did on 2026-09-13: it hid the other working
directories while this one was being read, and a card drew half a line.

## 1. Readings shown as they arrive

- [x] 1.1 `PipelineView` draws the other working directories whether this
  directory's reading is being taken, has arrived, or has failed.
- [x] 1.2 The loading note and the error stand where this directory's
  picture would, inside the tab, not instead of it. A reading that fails
  after one arrived keeps its picture under the error.
- [x] 1.3 The read-at line always renders and says "not read yet" for a
  reading that has not arrived. Worded "Last read not yet".

## 2. Whole lines on a card

- [x] 2.1 Core states a card's vertical chrome and line heights as `rem`
  tokens, and returns how many detail lines a card of a given height
  holds whole. `pipeline-card.ts`: `PIPELINE_CARD_REM`,
  `pipelineCardDetailLines` — two lines on a layout card with a state,
  three on a foreign card — and `fitPipelineCardDetails`.
- [x] 2.2 `shell-ui.ts` is written from the same constants; a test pins
  that the stylesheet and core agree. `pipeline-card-style.test.ts`.
- [x] 2.3 A detail line is a single line with an ellipsis at the card's
  width.
- [x] 2.4 Lines past a card's budget stay in the DOM and in the accessible
  name, visually hidden; the last drawn line says there is more; the
  `title` keeps the full text. Local and foreign cards alike. The count
  is a "+N" badge on the last drawn line, hidden from assistive
  technology, which reads the lines themselves.
- [x] 2.5 Phone-width lanes draw every line and hide none. The narrow
  view resets the hidden treatment, lets details wrap, and drops the
  badge.

## 3. Tests

2026-09-13: core `pipeline-card.test.ts` 6 tests; webui
`PipelineView.test.tsx` 23 and `pipeline-card-style.test.ts` 2, passed;
core, webui and the browser specs typecheck; the touched files lint.

- [x] 3.1 core: the budget for heights holding no detail line, one, and
  several.
- [x] 3.2 webui `PipelineView.test.tsx`: the survey arrives before this
  directory's reading — the other directories and the loading note are
  both shown; this directory's reading fails — the error and the other
  directories are both shown.
- [x] 3.3 webui: a card with more lines than its budget hides the rest,
  says there is more, and still carries every line's text. Also a card
  whose lines all fit counts nothing.
- [x] 3.4 Browser suite `e2e/pipeline.spec.ts`: no drawn line of any card
  extends past its card's box, and the tab passes axe at WCAG AA. Every
  name, state and drawn detail ends inside its card's inner edge, for
  local and foreign cards, beside the existing whole-name check.

## 4. Verification

- [x] 4.1 This change validates strictly. `check(validate-change)`
  2026-09-13, after the tasks above were ticked: valid.
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. 2026-09-13,
  exit 0: typecheck and every lint passed; cli 134 tests (13 files),
  core 1226 (87), extension 327 (24), server 86 (4), webui 410 (44).
- [x] 4.3 The whole browser suite, not a selected spec;
  `docs/images/standalone/pipeline.png` regenerated and looked at.
  Second run, 2026-09-13, after the cleanups below: 17 passed (3.5m),
  exit 0. Its picture is the one committed.
  First run, 2026-09-13: 16 passed and 1 failed — not this change's
  specs, which both passed with the new line check and axe, but
  `lifecycle-execution.spec.ts`, whose `afterEach` removed its workspace
  without retries and hit `EBUSY: rmdir .openspec-ui` after every
  assertion had passed. Run alone, that file passed 3 of 3. Its cleanup
  now retries the way `waiting-on-inbox.spec.ts`'s already did, and so
  does every other browser spec that removed a server's workspace in one
  attempt — `change-charts`, `documentation-screenshots`,
  `harness-screenshots`, `lifecycle-concurrent-hosts`,
  `lifecycle-recovery-and-rollback`, `scheduled-run` and `standalone` —
  since they share the cause and would fail the suite the same way. The
  picture from that run shows whole lines on every card, a long detail
  ending in an ellipsis, and no half line.
- [x] 4.4 A pending changeset exists. `check(changeset-present)`
  `.changeset/the-pipeline-shows-what-it-has-read.md`: core and webui
  minor.
