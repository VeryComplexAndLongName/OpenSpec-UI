The third step of ADR 0033's delivery order: the summary, as the mockup's
"Summary" artboard draws it (<https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L>).

## 1. The figures

- [x] 1.1 `packages/webui/src/summary-figures.ts` exports
  `summaryFigures(overview, inbox)`: the four tiles' figures and notes, the
  six specs with the most requirements, and the five latest archived changes.
- [x] 1.2 `packages/webui/src/summary-figures.test.ts` asserts each tile's
  figure and note, the ordering and length of both short lists, and the notes
  for an empty workspace and an unread inbox.
- [x] 1.3 `packages/webui/src/summary-figures.ts` exports `formatDay(iso)`,
  "16 Sep" for a timestamp, and its test covers a day and an unreadable value.

## 2. The rows

- [x] 2.1 `packages/webui/src/components/ChangesList.tsx` draws a column
  header and each row as name, state badge, progress bar with "done / total",
  and day, keeps its search, its windowing and its test ids, and puts where
  refs were read, the Refresh control and a fine-print line it is given at the
  foot of the panel.
- [x] 2.2 `packages/webui/src/components/ArchiveList.tsx` draws the columns
  of the "Recently archived" panel it opens from — the name without its date
  prefix (whole in the title), "done / total", day, with no bar — keeping its
  search, windowing and test ids.
- [x] 2.3 `ChangesList.test.tsx`, `ChangesList.standing.test.tsx` and
  `ArchiveList.test.tsx` assert the "done / total" text, the day, and, for
  active changes, the bar's accessible name carrying the percentage.

## 3. The panels

- [x] 3.1 `packages/webui/src/components/SummaryPanels.tsx` exports
  `SpecsPanel` (the six, and all on request) and `RecentlyArchivedPanel` (the
  five, and the full `ArchiveList` on request), each saying so in a line when
  it has nothing to list.
- [x] 3.2 `packages/webui/src/components/SummaryPanels.test.tsx` asserts both
  short lists, that asking for all shows the full ones, and both empty lines.
- [x] 3.3 `PageHead` in `packages/webui/src/components/PageHead.tsx` takes an
  optional action, drawn at the head's right.
- [x] 3.4 The summary tab in `packages/webui/src/standalone-entry.tsx` renders
  the tiles, the Changes panel, the two panels side by side, and Waiting on
  somebody in a panel after them, with Refresh as the page head's action.
- [x] 3.5 `shellThemeCss` in `packages/webui/src/shell-ui.ts` draws the rows'
  grid, the column header, the progress bar, the state badge, the two-column
  row of panels and the page head's action, from tokens only, and the rows
  carry no browser button fill. A state word longer than its column, such as
  "Further along in" a named branch, is cut inside its badge, whose title
  keeps it whole, and never drawn over the progress bar.

## 4. The browser suite

- [x] 4.1 Specs in `packages/server/e2e` that press Load summary press the
  page head's Refresh by its test id.
- [x] 4.2 `packages/server/e2e/frame-screenshots.spec.ts` also writes
  `summary-light.png` and `summary-dark.png`, the whole summary at 1280
  pixels.

  Record, 2026-09-16: the summary renders as the mockup's artboard in both
  themes against this repository on a live server (port 4317) and in the
  browser suite's fixture. Found while comparing live and fixed here: an empty
  schedule announcement region cost the page a grid gap under the head; the
  search's magnifier was painted under its input; a state hue lost to the row
  badge's steel on specificity. Two more from the owner's own check the same
  evening: "Further along in screens" ran over the progress bar in a
  150-pixel state column (now 220 pixels, cut inside the badge, whole in its
  title), and the full archive's bars ran into its day column in the
  half-width panel (now "done / total" with no bar, the name without its date
  prefix). The owner confirmed "Recently archived" behaves correctly.
  `tab-reading.spec.ts` asserts the page head's Refresh is held while the
  overview is read, since no button is left inside the tab's fieldset then.

## 5. Checks

- [x] 5.1 `openspec validate the-summary-looks-like-the-mockup --strict`
  passes.
- [x] 5.2 `npm run verify` passes, run unpiped. Record each package's count.
- [x] 5.3 A changeset: `@openspec-ui/webui` minor.
- [x] 5.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.
- [x] 5.5 The whole standalone browser suite passes. Record the count.

  Record, 2026-09-16: `openspec validate --strict` valid. `npm run verify`,
  unpiped: typecheck and lint pass in every workspace; tests — root scripts
  4 + 11 + 10 + 9 + 4, cli 161, core 1487 + 4, extension 379, server 103,
  webui 553 of 554. The one webui failure is
  `scripts/build-metro-icons.test.mjs`, the known Windows line-ending
  comparison of the generated icon module, which passes on Linux CI and is
  untouched here; webui was run again whole after the last edits, with the
  same result. `lint:english` (after `git add`), `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass. The
  whole standalone browser suite: 21 of 22 passed; the one failure,
  `tab-reading.spec.ts`, looked for a button inside the busy fieldset, where
  Refresh no longer is, and passes on its own after the fix in 4.1.

- [x] 5.6 **Human-only.** Whether `summary-light.png` and `summary-dark.png`
  match the mockup's "Summary" artboards.

  Record, 2026-09-16: the owner compared the running site with the mockup —
  the standalone server on port 4317, built from the Harness Settings branch,
  which carries this change and the ones beneath it — rather than the
  pictures, and found it good: "As far as I'm concerned, everything is fine."
