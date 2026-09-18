The Pipeline as the approved mockup draws it
(<https://claude.ai/artifact/79UGq85vxFKSiGGofi8md8>).

## 1. Core

- [x] 1.1 `packages/core/src/pipeline-card.ts`: `PIPELINE_CARD_REM` holds a
  Metro card's lengths; `pipelineCardHeight(parts)` adds them from what a
  card holds (state row, bar, callout, at most `PIPELINE_CARD_DETAIL_LINES`
  facts, footer, an open card's rows and headings); `PIPELINE_CARD_HEAD` is
  where a line meets a card; `fitPipelineCardDetails` defaults to the card's
  number of facts. `pipelineCardDetailLines` and `pipelineOpenCardHeight`
  go. `pipeline-card.test.ts` covers each part's length, the cap, the
  smallest card and the head.
- [x] 1.2 `packages/core/src/change-layout.ts`: `NODE_WIDTH` 21,
  `NODE_HEIGHT` 7, `COLUMN_GAP` 3.5, `ROW_GAP` 1; every column starts
  `LANE_HEADING` (2) down; a card's height is the one given, smaller than
  `NODE_HEIGHT` included; a line meets a card at `PIPELINE_CARD_HEAD`;
  `describeLane(column)` heads a column. `change-layout.test.ts` updated,
  with the headings and stacking cards of three heights.
- [x] 1.3 `packages/core/src/change-card.ts`: `describeChangeCard` keeps
  `lines` and adds `details`, each fact with its kind, where the done count is
  left to the bar and the `tasks` detail says only what a person or another
  agent must close; and `note`, the run's stage. `change-card.test.ts` covers
  the kinds, the count, a waiting run, a worktree and the note.

## 2. The view

- [x] 2.1 `packages/webui/src/components/PipelineView.tsx`: a card is a
  heading row (the name that opens the change, and the tasks control), a
  state row (a badge with the word, and the note), a bar with "N / M tasks"
  and the count in words for assistive technology, a waiting run's question
  in a callout, facts with a mark per kind, the open rows, and a footer of
  controls with "started here" for a run this host started. Every card's
  height, local or of another directory, is `pipelineCardHeight` of what it
  draws, passed to `layoutChanges`.
- [x] 2.2 The readiness facts the view adds (where a run is, its git author,
  what a change waits on, what it can start alongside, a collision, a missing
  worktree, also in) carry kinds; the card's title keeps every fact whole.
- [x] 2.3 An open card lists rows of a bordered list: number, task, and a tag
  ("Done", "In hand", "Probably next", "Open", "A person", the agent's id)
  with the whole word visually hidden; the rail between rows goes, and the
  legend explains only the line between cards.
- [x] 2.4 Controls keep their test ids and accessible names; Start, Continue
  and Allow are drawn as the forward button, Stop, Stop now and Deny as the
  stopping one, Copy folder path as a plain one. Icons are `aria-hidden`.
- [x] 2.5 A toolbar holds the reading line, the read-at line, this
  directory's runs, Open all, Close all, the zoom (its level is the reset),
  and Refresh; the picture is in a "Changes in this checkout" panel with each
  column headed; the other directories in an "Other working directories"
  panel. The tab has no panel of its own around them.
- [x] 2.6 `packages/webui/src/components/HintList.tsx`: a "Worth doing" panel
  with a notice tile, and Copy beside each command where the host can copy;
  without `copyText` no button is offered. `HintList.test.tsx` covers both.
- [x] 2.7 `packages/webui/src/components/pipeline-icons.tsx`: the marks and
  glyphs, every one `aria-hidden`.

## 3. Styles and tests

- [x] 3.1 `packages/webui/src/shell-ui.ts`: the Pipeline's rules rewritten
  from `PIPELINE_CARD_REM` through a zoom helper, in both themes and at phone
  width; a `--mauve` badge token for Blocked, in light, dark and the editor.
- [x] 3.2 `packages/webui/src/pipeline-card-style.test.ts` holds each card
  length in the stylesheet to core's, and each state's badge to its token and
  ink.
- [x] 3.3 `packages/webui/src/components/PipelineView.test.tsx`: the open
  rows' tags and height, the bar and its words, the facts' cap at four and the
  card's height for them, the callout and note of a waiting run, the forward
  and stopping controls, "started here".
- [x] 3.4 `packages/server/e2e/pipeline.spec.ts`: the legend's new sentence,
  no rail in an open card, and the first lane's heading by its whole name.

## 4. Checks

- [x] 4.1 `openspec validate the-pipeline-cards-wear-metro --strict` passes.
- [x] 4.2 `npm run verify` passes, run unpiped. Record each package's count.

  Done on 2026-09-17, on `main` a49e8f3: typecheck and lint pass in every
  package. Tests: `@openspec-ui/cli` 161 in 16 files; `openspec-ui-vscode`
  399 in 30 files; `@openspec-ui/server` 103 in 4 files;
  `@openspec-ui/webui` 598 of 599 in 70 files, the one failure being
  `scripts/build-metro-icons.test.mjs`, which fails on Windows only, where
  the checkout has CRLF line ends, as on `main`. `@openspec-ui/core` failed
  one test in that run: `spec-delta-check.test.ts` found this change's
  modified "A card shows only whole lines of its text" had renamed its
  scenario "More text than room". The scenario keeps its name now, and
  core's whole suite, run again on its own, passed 1506 in 108 files and 4
  in 2 git-subprocess files.

- [x] 4.3 A changeset, written with the implementation: `@openspec-ui/core`
  minor, `@openspec-ui/webui` minor, `openspec-ui-vscode` patch.
- [x] 4.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.

  Done: all pass after staging, inside 4.2's verify.

- [x] 4.5 The whole standalone browser suite passes, and `pipeline.png` and
  `pipeline-stop.png` are retaken. Record the count.

  Done on 2026-09-17: `npm run test:browser -w @openspec-ui/server`, all 24
  tests in one run, 24 passed in 5.1 minutes, the four of `pipeline.spec.ts`
  among them: axe at WCAG AA, and no line cut at 100% or, with a card open,
  at 150%. `pipeline.png`, `pipeline-stop.png` and `pipeline-stop-ask.png`
  are retaken; the pictures the other tests rewrote were put back.

- [x] 4.6 **Delegated to claude-cli.** Live: the Pipeline tab against this
  repository on a running server in both themes, and the editor's Pipeline
  panel in Dark Modern and Light Modern. Record how many cards each drew, that
  no line was cut, and how long the first cards took in the editor.

  Done on 2026-09-17 by Claude, which wrote this change, at the owner's
  request, for the owner to look at in turn.

  - **The shell**: a server from this branch against `C:/Prog/OpenSpec-UI`,
    Playwright at 1280 pixels. The first card came 2.9 s after the tab was
    chosen. In light and in dark: 5 cards in this checkout ("Merged in
    #541", three "Archived on main", "Ready"), 12 in three other working
    directories, one column headed "Step 1 · can start now", and no line of
    any card ending below its card, either as drawn or with every card open
    at 150%.
  - **The editor**: the Extension Development Host built from this branch,
    this repository open, the OpenSpec view showing, "OpenSpec UI: Open
    Pipeline": in Default Dark Modern the first cards came after 0.9 s, in
    Default Light Modern after 1.3 s; 5 cards each, and both readings
    answered.

- [x] 4.7 **Human-only.** Whether the Pipeline, in the browser and in VS Code,
  looks like the approved mockup.

  Done on 2026-09-17 by Claude, at the owner's request ("if there are human
  parts again, take them on yourself"), for the owner to look at in turn:
  it does. Compared with the mockup's light and dark artboards, in the
  browser and in the editor's panel: the toolbar with the reading and read-at
  lines on the left and Open all, Close all, the zoom and Refresh on the
  right; "Changes in this checkout" with its note and each column headed; a
  card with its name as a heading and a square tasks control, the badge in its
  state's colour, the bar and "N / M tasks", facts with their marks, and a
  footer where Start is filled cobalt and Stop now outlined red; "Worth doing"
  with the amber tile, the command and Copy; "Other working directories" with
  each directory's name, branch and path over its cards. Where it differs:
  the mockup's card showed "and 17 more" under five task rows, and an open
  card here lists every row, as a card has since a-card-opens-to-its-tasks;
  and in the editor's panel the toolbar wraps its controls under the text,
  the panel being narrower than the shell.
