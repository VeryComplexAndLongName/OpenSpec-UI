The screens of ADR 0032. Blocked by `the-web-ui-wears-more-metro`, which
brings in the families, the icons and the palette this change spends.

## 1. Harness Settings

- [ ] 1.1 `packages/webui/src/components/GlobalHarnessSettingsView.tsx` draws
  each `openspec-harness-section` as `<section className="panel">` with
  `<div className="panel-title">` holding the section's name and its icon.
  The stage rows and the two-column fields inside do not change.
- [ ] 1.2 `packages/webui/src/components/ChangeHarnessSettingsView.tsx` uses
  the same panel shape as 1.1.
- [ ] 1.3 `packages/webui/src/components/GlobalHarnessSettingsView.test.tsx`
  asserts a section renders one `.panel` with its name inside `.panel-title`,
  and that every field keeps its own accessible name.

## 2. The Timeline tab

- [ ] 2.1 `packages/webui/src/components/ChangeTimelineView.tsx` draws its task
  list as `<ul className="timeline">`, one `<li>` per task, the date in
  `<span className="time">` and the text in `<span className="data">`. The
  expand-on-click detail and the stale marker stay.
- [ ] 2.2 `packages/webui/src/components/ChangeTimelineView.test.tsx` asserts
  a stale task still carries its marker and an expanded task still shows its
  detail.
- [ ] 2.3 `packages/webui/src/components/MultiChangeTimelineView.tsx` draws a
  grid: a sticky first column naming the change, a day axis along the top, and
  one block per event placed by `grid-column`. The log-scaled `left:%` lanes
  go. The component keeps its current props.
- [ ] 2.4 `packages/webui/src/components/MultiChangeTimelineView.test.tsx`
  asserts an event of a known date lands in the column of that date, and that
  two changes with the same date share a column.

## 3. The summary and the state word

- [ ] 3.1 `packages/webui/src/standalone-entry.tsx`'s summary counts become
  tiles: a coloured square holding an `<Icon>`, then a label and a figure.
- [ ] 3.2 `packages/webui/src/components/ChangesList.tsx` draws a change's
  state word as `<span className="badge">`, keeping the state's colour token
  and the existing `openspec-change-state--*` class.
- [ ] 3.3 `packages/webui/src/components/ChangesList.test.tsx` asserts the
  state word still reads as text and still carries its state class.

## 4. Actions carry their icon

- [ ] 4.1 `packages/webui/src/components/ProcessesView.tsx`'s buttons carry an
  icon before the label — refresh, review, stop — with no change to the label
  text.
- [ ] 4.2 `packages/webui/src/components/PipelineView.tsx`'s card controls
  carry an icon before the label — start, stop, open — with no change to the
  picture's geometry or to `PIPELINE_CARD_REM`.
- [ ] 4.3 `packages/webui/src/components/PipelineView.test.tsx` asserts each
  control's accessible name is unchanged from before this change.

## 5. One arrangement, one stylesheet

- [ ] 5.1 `packages/webui/src/shell-ui.ts` gains the history grid of 2.3 and
  loses `openspec-status-card` and `openspec-data-card`.
- [ ] 5.2 `packages/webui/src/shell-ui.ts` loses the per-section rules of
  `openspec-shell-panel` and the rail rules of `openspec-timeline-task-*`,
  keeping the frame, the forms, the palette and the pipeline picture.
- [ ] 5.3 No `openspec-*` class named in `shell-ui.ts` is left without a rule,
  and no class used in a component is left without one either; the check that
  names both lives in `packages/webui/src/shell-ui.test.ts`.

## 6. Checks

- [ ] 6.1 `openspec validate the-web-ui-screens-wear-metro --strict` passes.
- [ ] 6.2 `npm run verify` passes, run unpiped. Record each package's count.
  Do not pipe it: a pipe reports the pipe's exit code.
- [ ] 6.3 A changeset: `@openspec-ui/webui` minor, `openspec-ui-vscode` patch.
- [ ] 6.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.
- [ ] 6.5 The whole standalone browser suite passes, including the axe WCAG AA
  run in both themes. Record the spec count. Run the whole suite, not the
  specs this change touched.
- [ ] 6.6 **Delegated to claude-cli.** A live check in the Extension
  Development Host: open Harness Settings, the Timeline tab and the Pipeline
  panel under the Dark Modern theme and again under a high-contrast theme.
  Evidence to record: for each theme, the computed `background-color` and
  `color` of one `.panel-title` and one `.badge`, read from the webview, and
  the screenshot path. A variable the editor layer fails to set shows as
  `rgba(0, 0, 0, 0)`.
- [ ] 6.7 **Human-only.** Whether the redesigned screens read well: whether a
  section's icon helps or decorates, whether the summary tiles are worth their
  space, and whether the multi-change grid is readable at a year's width.
