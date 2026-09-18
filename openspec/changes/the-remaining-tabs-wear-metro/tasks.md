The sixth and last step of ADR 0033's delivery order: the tabs that had no
mockup adopt the shared components. The Pipeline went with
`the-pipeline-cards-wear-metro`; these five are what is left.

Every task keeps each control's `data-testid`, `aria-label`, role and
accessible name exactly as it is (design.md, "The markup changes; the
handles do not"). A task that has to change one says so.

## 1. Run a Command

- [ ] 1.1 `packages/webui/src/standalone-entry.tsx`'s Run tab becomes one
  `openspec-controls` toolbar — the workspace root, the OpenSpec root and
  Initialize — above an `openspec-panel` for the run itself, replacing the
  two nested `openspec-shell-panel`s.
- [ ] 1.2 The tab's tip and its sync error become `openspec-panel-fine`
  inside that panel rather than loose `openspec-shell-note` paragraphs.
- [ ] 1.3 `packages/webui/src/components/AiPanel.tsx` puts its command,
  agent and change pickers in one `openspec-controls` row and keeps every
  picker a `select` with its current label (`AiPanel.test.tsx` and the
  browser specs pick options by name).
- [ ] 1.4 `AiPanel.tsx`'s "Run analysis" block becomes an
  `openspec-panel` whose head carries that name, and its status and data
  cards become `openspec-tile`s.
- [ ] 1.5 `AiPanel.tsx`'s event log becomes an `openspec-panel` with the
  count as its head note, and its empty state `openspec-panel-empty`.
- [ ] 1.6 `packages/webui/src/components/AiPanel.test.tsx` passes unchanged
  except where it reads a class this change moves; any such assertion moves
  to the new class in the same commit.

## 2. Processes and Recovery

- [ ] 2.1 `packages/webui/src/components/ProcessesView.tsx` draws one
  `openspec-panel` for the persisted runs, with the count as its head note
  and Refresh, the retain-days field and Forget in one `openspec-controls`
  row.
- [ ] 2.2 Its table becomes `openspec-table`, and a run's state becomes a
  `badge` whose word is the one the row shows today.
- [ ] 2.3 The details block becomes a second `openspec-panel` headed by the
  run it describes, with the changed files as a table rather than a bare
  list, and its `h3`/`h4` headings go.
- [ ] 2.4 "No persisted processes." becomes the panel's own
  `openspec-panel-empty`.
- [ ] 2.5 `packages/webui/src/components/ProcessesView.test.tsx` passes with
  no change to what it queries; where it reads a cell by text, the same text
  is in the table.

## 3. Diff Preview

- [ ] 3.1 `standalone-entry.tsx`'s Diff tab puts its picker and Refresh in
  an `openspec-controls` row and the diff in an `openspec-panel` whose head
  carries the change's name and whose note carries "N files changed".
- [ ] 3.2 "This change has nothing uncommitted." becomes
  `openspec-panel-empty`, and the truncation note becomes
  `openspec-panel-fine`.
- [ ] 3.3 The files the answer already carries are listed as an
  `openspec-table` above the diff, one row per file.
- [ ] 3.4 `packages/webui/src/components/ChangeDiff.tsx` keeps its
  `.openspec-diff-line--*` classes, since `ChangeDiff.test.tsx` reads them,
  and its body sits inside the panel body.

## 4. Change Editor

- [ ] 4.1 `standalone-entry.tsx`'s Change Editor puts Create, the change
  picker, Load and Run with Agentic Harness in one `openspec-controls`
  toolbar, replacing the first `openspec-ai-panel-controls` row.
- [ ] 4.2 Its document strip becomes `openspec-segmented` with
  `aria-pressed`, replacing `openspec-editor-tabs` and its `.is-active`;
  `shell-ui.ts` loses the rules for that strip once nothing wears it.
- [ ] 4.3 The editor and its preview sit in one `openspec-panel` whose head
  names the document being edited and whose foot carries Save; "Preview"
  stops being a note used as a heading.
- [ ] 4.4 The archived-template row keeps its own `openspec-controls` inside
  the panel section it belongs to.
- [ ] 4.5 `packages/webui/src/components/RunDialog.tsx` replaces its
  `openspec-shell-panel` and `h3` with an `openspec-panel` and its head,
  keeping `role="dialog"`, its focus behaviour and every `run-dialog-*`
  testid.
- [ ] 4.6 `packages/webui/src/components/HarnessChainPanel.tsx` puts its
  controls in `openspec-controls` and its event log in an
  `openspec-panel`, keeping `start-chain-button` and `chain-event-log`.
- [ ] 4.7 `RunDialog.test.tsx`, `RunDialog.standing.test.tsx` and
  `HarnessChainPanel.test.tsx` pass unchanged.

## 5. Templates

- [ ] 5.1 `standalone-entry.tsx`'s Templates tab puts Load templates in an
  `openspec-controls` row and draws one `openspec-panel` per category, each
  headed by the category, replacing the `colspan` sub-header row.
- [ ] 5.2 Each table becomes `openspec-table`, and a template's origin and
  its customized mark become badges.
- [ ] 5.3 The selected template becomes its own `openspec-panel` headed by
  its title, with its variables in the body and Insert into change in its
  foot.
- [ ] 5.4 Before anything is loaded the tab draws a panel saying so, rather
  than nothing.
- [ ] 5.5 The `templates-table` testid stays on a table, so
  `documentation-screenshots.spec.ts` still finds it.

## 6. The editor keeps its colours

- [ ] 6.1 `packages/webui/src/shell-ui.ts`'s `.openspec-extension-app`
  override list moves to every class this change renames, in the ordinary
  block and in the `forced-colors` block.
- [ ] 6.2 `packages/webui/src/vscode-metro-mapping.test.ts` and
  `shell-ui.test.ts` pass, including the token and colour-literal gates.
- [ ] 6.3 `packages/webui/src/extension-entry.tsx` draws the AI panel's
  markup with the same containers as the tab, so the editor and the shell
  differ only in colour.

## 7. The pictures and the checks

- [ ] 7.1 `packages/server/e2e/documentation-screenshots.spec.ts` reaches
  the harness row by a testid on the row rather than by
  `page.locator("div", { has: ... }).last()`, and the row carries it.
- [ ] 7.2 That spec's six pictures under `docs/images/standalone/` are
  retaken and staged.
- [ ] 7.3 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.
- [ ] 7.4 A changeset written with the implementation: `@openspec-ui/webui`
  minor, `openspec-ui-vscode` patch.
- [ ] 7.5 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.
- [ ] 7.6 The whole standalone browser suite passes, not only the specs this
  change touches. Record the count.
- [ ] 7.7 **Delegated to claude-cli.** A live check in the Extension
  Development Host: the AI panel under Default Dark Modern and a
  high-contrast theme. Evidence to record: the computed `background-color`
  and `color` of the panel and of one badge in each theme, that no token the
  editor layer maps is unset, and the screenshot paths.
- [ ] 7.8 **Human-only.** Whether the five tabs now read as the same
  product as the Summary, the Timeline and the Pipeline, from the captures
  this change retakes.
