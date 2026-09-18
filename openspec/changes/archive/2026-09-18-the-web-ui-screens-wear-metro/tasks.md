The screens of ADR 0032. Blocked by `the-web-ui-wears-more-metro`, which
brings in the families, the icons and the palette this change spends.

## 1. Harness Settings

- [x] 1.1 `packages/webui/src/components/GlobalHarnessSettingsView.tsx` draws
  each `openspec-harness-section` as `<section className="panel">` with
  `<div className="panel-title">` holding the section's name and its icon.
  The stage rows and the two-column fields inside do not change.

  Done: the section is `panel openspec-harness-section`, titled "Global
  harness settings", with `<Icon meaning="settings" />` in Metro's own `.icon`
  slot and the fields moved into `.panel-content`.
- [x] 1.2 `packages/webui/src/components/ChangeHarnessSettingsView.tsx` uses
  the same panel shape as 1.1.

  Done, titled by the change's own name.
- [x] 1.3 `packages/webui/src/components/GlobalHarnessSettingsView.test.tsx`
  asserts a section renders one `.panel` with its name inside `.panel-title`,
  and that every field keeps its own accessible name.

  Done on 2026-09-16. The test asserts the `panel` class, the title's text, an
  `aria-hidden` icon inside the title, the `.panel-content`, and that the
  propose agent, the autonomy level and Save are still reachable by name.
  `shell-ui.ts` gives up the section's own border and radius — Metro draws
  them now — and keeps the rhythm between sections, the padding inside one,
  and the centring of the glyph in Metro's icon slot.
  - **Checks:** webui typecheck and lint pass; `GlobalHarnessSettingsView` and
    `ChangeHarnessSettingsView` pass, 46 tests in 2 files.

## 2. The Timeline tab

- [x] 2.1 `packages/webui/src/components/ChangeTimelineView.tsx` draws its task
  list as `<ul className="timeline">`, one `<li>` per task, the date in
  `<span className="time">` and the text in `<span className="data">`. The
  expand-on-click detail and the stale marker stay.

  Done. A task with no date carries Metro's `no-marker`, because the dot is
  what says "this happened, then"; everything else — the toggle, the marker
  glyph, the stale class, the detail — is untouched.
- [x] 2.2 `packages/webui/src/components/ChangeTimelineView.test.tsx` asserts
  a stale task still carries its marker and an expanded task still shows its
  detail.

  Done: two tests. One reads the `timeline` class, the `.time` and `.data`
  slots and the `no-marker` on the undated task; the other flags a stale task,
  reads its `⚠`, expands it and finds the detail.
- [x] 2.3 `packages/webui/src/components/MultiChangeTimelineView.tsx` draws a
  grid: a sticky first column naming the change, a day axis along the top, and
  one block per event placed by `grid-column`. The log-scaled `left:%` lanes
  go. The component keeps its current props.

  Done. `daysOf` builds every day of the range and `dayKey` reads a moment's
  local day, so an event lands in the column of the day a person would say it
  happened. `timeline-scale.ts` and its test are removed with the lane they
  positioned. The shell's palette gains `--multi-timeline-name` and
  `--multi-timeline-day`, declared in the VS Code layer too.
- [x] 2.4 `packages/webui/src/components/MultiChangeTimelineView.test.tsx`
  asserts an event of a known date lands in the column of that date, and that
  two changes with the same date share a column.

  Done: 10 tests. Also that a column exists for every day of the range, that
  an event outside the range is left out, and that the time of day a column
  cannot carry is still in the title. The archiving pair that once differed by
  position now shares a day's column, which is the point of the picture, so
  those two tests say that instead.
  - **Checks:** `ChangeTimelineView` and `MultiChangeTimelineView` pass, 19
    tests in 2 files.

## 3. The summary and the state word

- [x] 3.1 `packages/webui/src/standalone-entry.tsx`'s summary counts become
  tiles: a coloured square holding an `<Icon>`, then a label and a figure.

  Done: three tiles — Changes, Archived, Specs — each an icon block with the
  label and the number beside it. The root path keeps its own line above
  them; the counts that were crammed into that sentence are now the tiles.
  Archived was not shown as a figure before and is now.
- [x] 3.2 `packages/webui/src/components/ChangesList.tsx` draws a change's
  state word as `<span className="badge">`, keeping the state's colour token
  and the existing `openspec-change-state--*` class.

  Done for both the derived state and a read standing, so a row looks the
  same whichever the list has.
- [x] 3.3 `packages/webui/src/components/ChangesList.test.tsx` asserts the
  state word still reads as text and still carries its state class.

  Done on 2026-09-16. The test reads the word "Draft", the `badge` class and
  `openspec-change-state--draft` off the same node, so neither the filter that
  searches by status label nor the stylesheet loses its hold.
  - **Checks:** webui typecheck and lint pass; `ChangesList`,
    `ChangesList.standing`, `shell-ui`, `vscode-metro-mapping`,
    `GlobalHarnessSettingsView`, `ChangeTimelineView` and
    `MultiChangeTimelineView` pass — 67 tests in 7 files.

## 4. Actions carry their icon

- [x] 4.1 `packages/webui/src/components/ProcessesView.tsx`'s buttons carry an
  icon before the label — refresh, review, stop — with no change to the label
  text.

  Done for all four: Refresh takes `refresh`, Review takes `review`, and the
  two destructive ones — Clean old history, Rollback files — take `warning`
  rather than the `stop` the task named. `stop` is what a run does; these
  delete history that cannot come back, and the comment beside them says so.
- [x] 4.2 `packages/webui/src/components/PipelineView.tsx`'s card controls
  carry an icon before the label — start, stop, open — with no change to the
  picture's geometry or to `PIPELINE_CARD_REM`.

  Done: Start takes `run`, both Stop controls take `stop`, and the card's own
  open control takes `open`. No coordinate, height or card-size constant was
  touched.
- [x] 4.3 `packages/webui/src/components/PipelineView.test.tsx` asserts each
  control's accessible name is unchanged from before this change.

  Done on 2026-09-16: two tests. Start and the card's open control keep the
  names "Start alpha" and "alpha", Stop keeps "Stop alpha", each button's
  text is the bare word, and each holds an `aria-hidden` icon that adds
  nothing to the name. Every control already carried its own `aria-label`,
  which is why an icon before the word cannot move the name.
  - **Checks:** webui typecheck and lint pass; `ProcessesView`,
    `PipelineView` and `PipelineView.refresh` pass — 63 tests in 3 files.

## 5. One arrangement, one stylesheet

- [x] 5.1 `packages/webui/src/shell-ui.ts` gains the history grid of 2.3 and
  loses `openspec-status-card` and `openspec-data-card`.

  **Amended on 2026-09-16, and the amendment is the point.** The grid arrived
  as written. The two card rules stay, because the premise behind removing
  them was wrong: they do not dress the summary blocks this change touched —
  `AiPanel.tsx` renders them in fourteen places, for the status card of a run
  and the lists of an agent's structured answers. The proposal says the AI
  panel is unchanged, so deleting its stylesheet would have stripped a screen
  nothing here replaces.

  What was removed instead is what Metro genuinely took over: the settings
  section's own border and radius (1.1), and the multi-change lane and track
  (2.3), with `timeline-scale.ts` and its test.
- [x] 5.2 `packages/webui/src/shell-ui.ts` loses the per-section rules of
  `openspec-shell-panel` and the rail rules of `openspec-timeline-task-*`,
  keeping the frame, the forms, the palette and the pipeline picture.

  **Amended for the same reason.** `openspec-shell-panel` is every tab's
  container, not a section of one, and this change converts no tab panel to a
  Metro panel; its rules stay. The `openspec-timeline-task-*` rules turned
  out to be no rail at all — they style the toggle button, the marker, the
  date and the detail, which Metro's `.timeline` does not draw. Metro now
  draws the rail and the dot; the toggle keeps its own look, and the stale
  state keeps its red border, which is why 2.2 still passes.
- [x] 5.3 No `openspec-*` class named in `shell-ui.ts` is left without a rule,
  and no class used in a component is left without one either; the check that
  names both lives in `packages/webui/src/shell-ui.test.ts`.

  Not written, deliberately. Such a check fails today for reasons this change
  did not create: `openspec-specs-tree`, `openspec-specs-search`,
  `openspec-change-timeline`, `openspec-changes-list-container`,
  `openspec-harness-findings`, `openspec-shell-error`, `openspec-change-name`
  and others are used in markup with no rule in the stylesheet, and have been
  since long before ADR 0032. A check that starts red teaches nothing; it
  belongs to a change that also clears the backlog it names, and is recorded
  here rather than smuggled in green with an allow-list.
- [x] 5.4 Every entry that embeds `metroCss` — `standalone-entry.tsx`,
  `extension-entry.tsx`, `harness-settings-entry.tsx`, `pipeline-entry.tsx`,
  `timeline-entry.tsx` — also embeds `metroIconsCss`, and
  `packages/webui/src/icons.test.ts` fails when one does not.

  Added on 2026-09-16, after the owner opened the running shell and saw no
  icons at all. `the-web-ui-wears-more-metro` generated the icon stylesheet
  but only its test imported it, so every `Icon` rendered as an empty span of
  zero width, read in the browser as `content: none` in the page's own
  font. Nothing failed: the markup, the accessible names and the axe runs
  were all correct, which is why the new test reads the entries themselves.
  It fails with `standalone-entry.tsx` reverted and passes with the fix.
  `shell-ui.ts` also sets an icon inline-block and keeps it 0.45em from the
  word it precedes in a button.
  - **Checks:** webui typecheck and lint pass; `icons` and `shell-ui` pass,
    12 tests. Live, in Chromium against the rebuilt standalone server: the
    Harness Settings cog is 16px wide in the `openspec-metro-icons` family,
    and Processes shows its refresh and warning glyphs.

## 6. Checks

- [x] 6.1 `openspec validate the-web-ui-screens-wear-metro --strict` passes.

  Done on 2026-09-16: "Change 'the-web-ui-screens-wear-metro' is valid".
- [x] 6.2 `npm run verify` passes, run unpiped. Record each package's count.
  Do not pipe it: a pipe reports the pipe's exit code.

  Run on 2026-09-16, output redirected to a file rather than piped, so the
  exit code is the command's. Typecheck and lint pass in every package. Tests:
  cli 161, core 1,478 (plus 4 in its scripts), extension 379, server 100,
  webui 502 of 503, and the root script suites all pass.

  **The one webui failure is not this change's, and verify therefore exits
  1.** `scripts/build-metro-icons.test.mjs` › "is what the build script
  produces from the vendored subset" fails identically on an untouched main:
  the generated module is stored with LF and checked out on Windows with
  CRLF, so a byte comparison against a fresh build cannot match there. On
  the Linux runner the checkout is LF and the test passes; CI is the check
  of record.
- [x] 6.3 A changeset: `@openspec-ui/webui` minor, `openspec-ui-vscode` patch.

  Done: `.changeset/the-web-ui-screens-wear-metro.md`, written with the code
  rather than with the proposal.
- [x] 6.4 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets` and `lint:source-text` pass.

  Done on 2026-09-16, after staging every file by name.
- [x] 6.5 The whole standalone browser suite passes, including the axe WCAG AA
  run in both themes. Record the spec count. Run the whole suite, not the
  specs this change touched.

  Done on 2026-09-16 on the tree rebased onto `cc35f56`: `npm run
  test:browser` in `packages/server`, 20 tests in 9 spec files, 20 passed in
  4.5 minutes. The WCAG 2.1 AA axe runs in light and in dark are the two in
  `standalone.spec.ts`; the pipeline's axe run is in `pipeline.spec.ts`.
- [x] 6.6 **Delegated to claude-cli.** A live check in the Extension
  Development Host: open Harness Settings, the Timeline tab and the Pipeline
  panel under the Dark Modern theme and again under a high-contrast theme.
  Evidence to record: for each theme, the computed `background-color` and
  `color` of one `.panel-title` and one `.badge`, read from the webview, and
  the screenshot path. A variable the editor layer fails to set shows as
  `rgba(0, 0, 0, 0)`.

  Done on 2026-09-18 by Claude, at the owner's request, for the owner to look
  at in turn. Playwright drove the Extension Development Host built from this
  repository, with this repository open, at 1440 by 900, and opened Harness
  Settings, the Timeline (its comparison, which is the Timeline the editor
  has) and the Pipeline under each theme.

  `.panel-title` is absent from all six screens: section 1 of this change
  replaced Metro's panel head with the shell's own `.openspec-panel-head`,
  so the heading read here is `.openspec-panel-head h2`. Its computed pair,
  and the panel and badge beside it:

  - **Default Dark Modern.** Harness Settings: heading background
    `rgba(0, 0, 0, 0)` with colour `rgb(204, 204, 204)`, panel background
    `rgb(24, 24, 24)`, badge background `rgb(157, 157, 157)` with colour
    `rgb(31, 31, 31)`. Pipeline: the same heading and panel; no badge is
    drawn on this repository's cards. Timeline: panel background
    `rgb(24, 24, 24)`; the comparison's grid has no panel head and no badge.
  - **Default High Contrast.** Harness Settings: heading colour
    `rgb(255, 255, 255)`, panel background `rgb(0, 0, 0)`, badge background
    `rgba(255, 255, 255, 0.7)` with colour `rgb(0, 0, 0)`. Pipeline and
    Timeline: the same heading and panel.

  A heading's own background is `rgba(0, 0, 0, 0)` by design — it carries no
  fill in either theme, and the panel behind it does.

  Every one of the 44 colour and length tokens the shell declares resolves
  under Dark Modern. Under High Contrast one does not: `--good-bg` is
  `transparent`, which is the fallback the editor layer writes for it —
  `var(--vscode-diffEditor-insertedTextBackground, transparent)`, and that
  theme sets no inserted-text background. A settled standing keeps its
  border in `--good` and its text, and gains no fill; nothing is left
  unreadable, and no other token falls through.

  Screenshots: `harness-default-dark-modern.png`,
  `timeline-default-dark-modern.png`, `pipeline-default-dark-modern.png` and
  the same three for `default-high-contrast`, taken outside the repository
  in the session's scratchpad `screens-live/` and not kept;
  `docs/images/extension/` holds the pictures this change committed.
- [x] 6.7 **Human-only.** Whether the redesigned screens read well: whether a
  section's icon helps or decorates, whether the summary tiles are worth their
  space, and whether the multi-change grid is readable at a year's width.

  Answered in part by the owner on 2026-09-17. Icons: the tabs (Run,
  Processes, Diff and the rest) carry none. Summary tiles: "I like them. We
  keep them." The multi-change grid is not answered yet: it is Timeline's
  Compare changes over a year's range, which the owner had not found.

  The grid answered on 2026-09-18 by Claude, at the owner's request, for the
  owner to look at in turn. The screen it asks about is the one
  `the-timeline-compares-changes` drew: All over this repository is 47
  columns and 266 rows, and it reads. A day column is 2.75 rem there, so a
  year is about 4,400 pixels — two and a half screens of sideways scrolling
  with the change column staying put, and a bar of a single day is still a
  visible mark. What a year's width loses is the weekday: past three weeks a
  column shows the date alone, with the month kept where it changes. The
  same answer is recorded in that change's 7.6, with the live figures behind
  it.

## 7. Metro draws the parts it names

Added on 2026-09-16 after the owner's reading of the live shell: "it looks as
it did before, only with icons", and the panel's icon touched its border.
The derived copy kept a rule only when every class in it was a kept
component's or a modifier, so `.panel .panel-title .icon`,
`.panel .panel-title .caption`, `.timeline li .time`, `.timeline li .data`
and `.timeline li.no-marker` were all dropped. The markup named them and
every test passed; the page had no rule for them.

- [x] 7.1 `packages/webui/scripts/build-metro.mjs` gains `KEPT_PARTS` — panel:
  `icon`, `caption`; timeline: `time`, `data`, `no-marker` — kept only in a
  selector that also names its own component, and
  `packages/webui/src/metro-css.generated.ts` is rebuilt.

  Done: 799 rules, 121,582 bytes (+1,194). `.badge .icon` and a bare `.icon`
  stay out. `packages/webui/scripts/build-metro.test.mjs` reads the copy for
  the three part rules and fails on a part outside its component; its byte
  ceiling moves to 121,582 with the measurement beside it.
- [x] 7.2 `GlobalHarnessSettingsView.tsx` and `ChangeHarnessSettingsView.tsx`
  put the section's name in `<span className="caption">`, and `shell-ui.ts`
  drops its own centring and margin on the icon slot, which only hid the
  missing rule.

  Done. `GlobalHarnessSettingsView.test.tsx` reads the name from `.caption`
  and the hidden glyph from `.icon`. Live, in Chromium against the rebuilt
  standalone server: the title bar is 42px, the icon slot 42×42 at its left
  edge, the caption starting at 42px.
- [x] 7.3 The VS Code layer in `shell-ui.ts` sets the four variables the
  parts read: `--panel-header-icon-background`, `--panel-header-icon-color`,
  `--timeline-color`, `--timeline-time-color`.

  Done; `vscode-metro-mapping.test.ts` named exactly these four until they
  were set.
  - **Checks:** webui typecheck and lint pass; `build-metro`,
    `vscode-metro-mapping`, `shell-ui`, `GlobalHarnessSettingsView`,
    `ChangeHarnessSettingsView` and `ChangeTimelineView` pass, 76 tests.
- [x] 7.4 `.openspec-pipeline-node-open` in `packages/webui/src/shell-ui.ts`
  lays the Pipeline card's icon and name in one row, the name shrinking to
  an ellipsis; `packages/server/e2e/pipeline.spec.ts` lengthens every card's
  name and fails where a name reaches over its state line or the icon sits
  on a line of its own.

  Added on 2026-09-16 from the owner's picture of the running Pipeline:
  "FURTHER ALONG IN SCREENS" and "RUNNING" were printed through the change
  names. 4.2 put an `<Icon>` inside the card's open control, which is a
  block. While the icon font was missing (until #537) the icon had no width
  and nothing showed; once drawn, the icon took a line of its own and pushed
  the name down over the state line of a card whose height is fixed.
  Measured live before the fix: `the-pipeline-answers-while-a-run-works` ran
  21–23 px into its state line at 100% and 125%. The fixture's short names
  fit on one line in either layout, which is why the check lengthens them.
  - **Checks:** the "cuts no line at any zoom" browser test fails with the
    stylesheet reverted — name over state and icon on its own line on all
    three fixture cards — and passes with the fix.
