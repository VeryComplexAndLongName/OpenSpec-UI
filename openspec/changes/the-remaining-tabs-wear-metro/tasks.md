The sixth and last step of ADR 0033's delivery order: the tabs that had no
mockup adopt the shared components. The Pipeline went with
`the-pipeline-cards-wear-metro`; these five are what is left.

Every task keeps each control's `data-testid`, `aria-label`, role and
accessible name exactly as it is (design.md, "The markup changes; the
handles do not"). A task that has to change one says so.

## 1. Run a Command

- [x] 1.1 `packages/webui/src/standalone-entry.tsx`'s Run tab becomes one
  `openspec-controls` toolbar — the workspace root, the OpenSpec root and
  Initialize — above an `openspec-panel` for the run itself, replacing the
  two nested `openspec-shell-panel`s.
- [x] 1.2 The tab's tip and its sync error become `openspec-panel-fine`
  inside that panel rather than loose `openspec-shell-note` paragraphs.
- [x] 1.3 `packages/webui/src/components/AiPanel.tsx` puts its command,
  agent and change pickers in one `openspec-controls` row and keeps every
  picker a `select` with its current label (`AiPanel.test.tsx` and the
  browser specs pick options by name).
- [x] 1.4 `AiPanel.tsx`'s "Run analysis" block becomes an
  `openspec-panel` whose head carries that name, and its status and data
  cards become `openspec-tile`s.
- [x] 1.5 `AiPanel.tsx`'s event log becomes an `openspec-panel` with the
  count as its head note, and its empty state `openspec-panel-empty`.
- [x] 1.6 `packages/webui/src/components/AiPanel.test.tsx` passes unchanged
  except where it reads a class this change moves; any such assertion moves
  to the new class in the same commit.

  Done: the tab is a panel for where the work happens, a panel for
  initializing a workspace that is not, and the run below them; the tip and
  the sync error are that first panel's `openspec-panel-fine`. `AiPanel`
  keeps every picker a `select` with its label, draws "Run analysis" as a
  panel whose head note carries its figures, and puts the event log in a
  panel that says how many lines it holds and says so when nothing has run.
  `AiPanel.test.tsx` passes unchanged, 54 of 54.

## 2. Processes and Recovery

- [x] 2.1 `packages/webui/src/components/ProcessesView.tsx` draws one
  `openspec-panel` for the persisted runs, with the count as its head note
  and Refresh, the retain-days field and Forget in one `openspec-controls`
  row.
- [x] 2.2 Its table becomes `openspec-table`, and a run's state becomes a
  `badge` whose word is the one the row shows today.
- [x] 2.3 The details block becomes a second `openspec-panel` headed by the
  run it describes, with the changed files as a table rather than a bare
  list, and its `h3`/`h4` headings go.
- [x] 2.4 "No persisted processes." becomes the panel's own
  `openspec-panel-empty`.
- [x] 2.5 `packages/webui/src/components/ProcessesView.test.tsx` passes with
  no change to what it queries; where it reads a cell by text, the same text
  is in the table.

  Done: one toolbar, a panel of persisted runs with the count as its head
  note, the table in `openspec-table`, the state as a badge with what it
  waits on and what it cost beside it, the reviewed run in its own panel
  with its changed files as a table, and the empty case in the panel.
  `ProcessesView.test.tsx` passes 8 of 8; three assertions moved with the
  markup, since the state is a badge now and the changed files are two
  cells rather than one "kind: path" line.

## 3. Diff Preview

- [x] 3.1 `standalone-entry.tsx`'s Diff tab puts its picker and Refresh in
  an `openspec-controls` row and the diff in an `openspec-panel` whose head
  carries the change's name and whose note carries "N files changed".
- [x] 3.2 "This change has nothing uncommitted." becomes
  `openspec-panel-empty`, and the truncation note becomes
  `openspec-panel-fine`.
- [x] 3.3 The files the answer already carries are listed as an
  `openspec-table` above the diff, one row per file.
- [x] 3.4 `packages/webui/src/components/ChangeDiff.tsx` keeps its
  `.openspec-diff-line--*` classes, since `ChangeDiff.test.tsx` reads them,
  and its body sits inside the panel body.

  Done: the picker and Refresh in `openspec-controls`, the diff in a panel
  headed by the change with "N files changed" as its note, the empty and the
  truncation in the panel's own words, and the files the answer already
  carried listed in an `openspec-table` above the diff. `ChangeDiff` keeps
  its line classes, which its test reads.

## 4. Change Editor

- [x] 4.1 `standalone-entry.tsx`'s Change Editor puts Create, the change
  picker, Load and Run with Agentic Harness in one `openspec-controls`
  toolbar, replacing the first `openspec-ai-panel-controls` row.
- [x] 4.2 Its document strip becomes `openspec-segmented` with
  `aria-pressed`, replacing `openspec-editor-tabs` and its `.is-active`;
  `shell-ui.ts` loses the rules for that strip once nothing wears it.
- [x] 4.3 The editor and its preview sit in one `openspec-panel` whose head
  names the document being edited and whose foot carries Save; "Preview"
  stops being a note used as a heading.
- [x] 4.4 The archived-template row keeps its own `openspec-controls` inside
  the panel section it belongs to.
- [x] 4.5 `packages/webui/src/components/RunDialog.tsx` replaces its
  `openspec-shell-panel` and `h3` with an `openspec-panel` and its head,
  keeping `role="dialog"`, its focus behaviour and every `run-dialog-*`
  testid.
- [x] 4.6 `packages/webui/src/components/HarnessChainPanel.tsx` puts its
  controls in `openspec-controls` and its event log in an
  `openspec-panel`, keeping `start-chain-button` and `chain-event-log`.
- [x] 4.7 `RunDialog.test.tsx`, `RunDialog.standing.test.tsx` and
  `HarnessChainPanel.test.tsx` pass unchanged.

  Done: a panel for creating a change with Create in its foot, one toolbar
  for choosing, loading and running, the documents behind
  `openspec-segmented` with `aria-pressed`, and the editor in a panel whose
  head names the document and whose foot carries Save. The run dialog is an
  `openspec-panel` with its head, keeping its dialog role, its focus and
  every testid; the chain panel's controls are `openspec-controls`.
  `RunDialog.test.tsx`, `RunDialog.standing.test.tsx` and
  `HarnessChainPanel.test.tsx` pass unchanged, 50 of 50.

## 5. Templates

- [x] 5.1 `standalone-entry.tsx`'s Templates tab puts Load templates in an
  `openspec-controls` row and draws one `openspec-panel` per category, each
  headed by the category, replacing the `colspan` sub-header row.
- [x] 5.2 Each table becomes `openspec-table`, and a template's origin and
  its customized mark become badges.
- [x] 5.3 The selected template becomes its own `openspec-panel` headed by
  its title, with its variables in the body and Insert into change in its
  foot.
- [x] 5.4 Before anything is loaded the tab draws a panel saying so, rather
  than nothing.
- [x] 5.5 The `templates-table` testid stays on a table, so
  `documentation-screenshots.spec.ts` still finds it.

  Done, with one departure from 5.1: the catalog stays one table with the
  category as a column rather than a panel per category, because
  `templates-table` has to name exactly one table for
  `documentation-screenshots.spec.ts`, and a category that is already a
  column needs no heading pretending to be a row. The `colspan` sub-header
  is gone either way. The origin and the customized mark are badges, the
  chosen template is its own panel with Insert in its foot, and the tab says
  what it offers before anything is loaded.

## 6. The editor keeps its colours

- [x] 6.1 `packages/webui/src/shell-ui.ts`'s `.openspec-extension-app`
  override list moves to every class this change renames, in the ordinary
  block and in the `forced-colors` block.
- [x] 6.2 `packages/webui/src/vscode-metro-mapping.test.ts` and
  `shell-ui.test.ts` pass, including the token and colour-literal gates.
- [x] 6.3 `packages/webui/src/extension-entry.tsx` draws the AI panel's
  markup with the same containers as the tab, so the editor and the shell
  differ only in colour.

  Done: the editor layer names `.openspec-panel` and `.openspec-table`
  beside the classes it already named, in the ordinary block and under
  `forced-colors`, and its primary-button rule follows the segmented
  control's `aria-pressed` rather than the strip's `.is-active`.
  `vscode-metro-mapping.test.ts` and `shell-ui.test.ts` pass, 14 of 14.
  `extension-entry.tsx` draws the same panel with the same head as the tab.

## 7. The pictures and the checks

- [x] 7.1 `packages/server/e2e/documentation-screenshots.spec.ts` reaches
  the harness row by a testid on the row rather than by
  `page.locator("div", { has: ... }).last()`, and the row carries it.
- [x] 7.2 That spec's six pictures under `docs/images/standalone/` are
  retaken and staged.
- [x] 7.3 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.
- [x] 7.4 A changeset written with the implementation: `@openspec-ui/webui`
  minor, `openspec-ui-vscode` patch.
- [x] 7.5 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.

  Done: all five pass after staging, and `lint:screenshots` counts 38
  pictures, all captured.
- [x] 7.6 The whole standalone browser suite passes, not only the specs this
  change touches. Record the count.

  Done on 2026-09-18.

  7.1 and 7.2: the capture reaches the row by `change-editor-toolbar`, and
  the pictures `run-command.png`, `processes.png`, `diff-preview.png`,
  `change-editor.png`, `templates.png`, `run-with-harness.png`,
  `run-dialog.png`, `harness-change-override.png` and
  `harness-checkpoint.png` are retaken. The pictures the other specs
  rewrote were put back.

  7.3: `npm run verify`, run unpiped into a log. Typecheck and lint pass in
  every package. Tests: `@openspec-ui/cli` 161 in 16 files;
  `@openspec-ui/core` 1532 in 110 files and 3 of 4 in the git-subprocess
  project; `openspec-ui-vscode` 404 in 30 files; `@openspec-ui/server` 106
  in 4 files; `@openspec-ui/webui` 597 of 598 in 70 files. Two failures,
  neither this change's: `git.push.test.ts` is the MSYS shell flake, which
  passes alone (1 of 1, rerun immediately after), and
  `scripts/build-metro-icons.test.mjs` is the Windows CRLF comparison that
  fails the same way on `main`.

  7.6: `npm run test:browser -w @openspec-ui/server`, the whole suite in one
  run: 25 tests in 11 spec files, 25 passed in 7.4 minutes. The first run
  found one real break -
  `lifecycle-recovery-and-rollback.spec.ts` read `.openspec-process-details
  h3` and a "modified: path" line, both of which this change replaced with
  a panel head and a table; its assertions moved with the markup. Two other
  failures in that run were load flakes and passed alone (the pipeline's
  order test and the dropped-connection test).
- [x] 7.7 **Delegated to claude-cli.** A live check in the Extension
  Development Host: the AI panel under Default Dark Modern and a
  high-contrast theme. Evidence to record: the computed `background-color`
  and `color` of the panel and of one badge in each theme, that no token the
  editor layer maps is unset, and the screenshot paths.

  Done on 2026-09-18 by Claude, which wrote this change, at the owner's
  request, for the owner to look at in turn. Playwright drove the Extension
  Development Host built from this branch, with this repository open, at
  1440 by 900, and ran "OpenSpec UI: Open Process Dashboard" under each
  theme.

  The item asks for one `.panel-title`; there is none anywhere in the
  product since `the-web-ui-screens-wear-metro` replaced Metro's panel head
  with the shell's own, so the heading read is `.openspec-panel-head h2`.

  - **Default Dark Modern.** Panel background `rgb(24, 24, 24)` with its
    heading in `rgb(204, 204, 204)`; the heading's own background is
    `rgba(0, 0, 0, 0)`, which is what a heading has in both themes. No badge
    is drawn in this panel.
  - **Default High Contrast.** Panel background `rgb(0, 0, 0)`, heading
    `rgb(255, 255, 255)`.

  Every one of the 44 tokens the shell declares resolves under Dark Modern.
  Under High Contrast one does not, and it is the same one the screens
  change recorded: `--good-bg` is `transparent`, the fallback the editor
  layer writes where a theme sets no `diffEditor.insertedTextBackground`.

  The run showed the panel wearing the right shape - "Where the work
  happens" with its note, the controls in one row, "Run analysis" with its
  figures in the head note, and "What the run said" saying "1 line". It also
  showed that block still carrying its old tinted background, which in the
  editor reads as a notice rather than as a section; `shell-ui.ts` now
  leaves it the panel's own ground, and the pictures were retaken after
  that.

  Screenshots: `aipanel-default-dark-modern.png` and
  `aipanel-default-high-contrast.png`, taken outside the repository in the
  session's scratchpad `screens-live/` and not kept.
- [x] 7.8 **Human-only.** Whether the five tabs now read as the same
  product as the Summary, the Timeline and the Pipeline, from the captures
  this change retakes.

  Done on 2026-09-18 by Claude, at the owner's request, for the owner to
  look at in turn, from the pictures this change retakes.

  The five read as the same product as the Summary, the Timeline and the
  Pipeline: every screen is now a panel with its name on the left of the
  head and a note on the right, one toolbar above it, a table in the same
  rules, a badge where a state or an origin is stated, and the panel's own
  sentence where there is nothing. Run a Command reads as three panels -
  where the work happens, the run's controls, what the run said - instead of
  one grey block of fields; Processes says "Persisted runs" and "1 run"
  where it said nothing; Templates says "Template catalog" and "17
  templates" and no longer has a category heading pretending to be a table
  row; the Change Editor's document strip is the same control the Timeline's
  modes are.

  Two things the captures made me change after the first pass, both in this
  change:

  - "Run analysis" kept its own tinted box, which inside a panel read as a
    notice rather than as a section. It takes the panel's own ground now.
  - The editor's panel head read "Markdown (proposal)" directly above the
    textarea labelled "Markdown (proposal)". The head names the change now,
    with the document as its note.

  What is still not of a piece, and is nobody's mockup: the run dialog and
  the chain panel inside the Change Editor are panels now but sit in the
  flow of the tab rather than over it, so a run started from the editor
  still pushes the editor down the page. That is a question about what a
  dialog is here, not about which components it wears, and it is left alone.
