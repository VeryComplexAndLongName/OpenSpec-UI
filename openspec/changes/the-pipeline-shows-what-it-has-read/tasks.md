Two things the Pipeline tab did on 2026-09-13: it hid the other working
directories while this one was being read, and a card drew half a line.

## 1. Readings shown as they arrive

- [ ] 1.1 `PipelineView` draws the other working directories whether this
  directory's reading is being taken, has arrived, or has failed.
- [ ] 1.2 The loading note and the error stand where this directory's
  picture would, inside the tab, not instead of it.
- [ ] 1.3 The read-at line always renders and says "not read yet" for a
  reading that has not arrived.

## 2. Whole lines on a card

- [ ] 2.1 Core states a card's vertical chrome and line heights as `rem`
  tokens, and returns how many detail lines a card of a given height
  holds whole.
- [ ] 2.2 `shell-ui.ts` is written from the same constants; a test pins
  that the stylesheet and core agree.
- [ ] 2.3 A detail line is a single line with an ellipsis at the card's
  width.
- [ ] 2.4 Lines past a card's budget stay in the DOM and in the accessible
  name, visually hidden; the last drawn line says there is more; the
  `title` keeps the full text. Local and foreign cards alike.
- [ ] 2.5 Phone-width lanes draw every line and hide none.

## 3. Tests

- [ ] 3.1 core: the budget for heights holding no detail line, one, and
  several.
- [ ] 3.2 webui `PipelineView.test.tsx`: the survey arrives before this
  directory's reading — the other directories and the loading note are
  both shown; this directory's reading fails — the error and the other
  directories are both shown.
- [ ] 3.3 webui: a card with more lines than its budget hides the rest,
  says there is more, and still carries every line's text.
- [ ] 3.4 Browser suite `e2e/pipeline.spec.ts`: no drawn line of any card
  extends past its card's box, and the tab passes axe at WCAG AA.

## 4. Verification

- [ ] 4.1 This change validates strictly. `check(validate-change)`
- [ ] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 4.3 The whole browser suite, not a selected spec;
  `docs/images/standalone/pipeline.png` regenerated and looked at.
- [ ] 4.4 A pending changeset exists. `check(changeset-present)`
