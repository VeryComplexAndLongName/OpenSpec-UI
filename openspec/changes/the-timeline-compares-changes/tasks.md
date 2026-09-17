The fifth step of ADR 0033's delivery order: the Timeline's comparison, as
the mockup's "Timeline: compare changes" artboard draws it
(<https://claude.ai/artifact/AXRHtMxhY2EsznHoAPo19L>).

## 1. Core dates the whole workspace in one pass

- [ ] 1.1 A new `packages/core/src/change-spans.ts` exports `ChangeSpan`
  (`changeName`, `archived`, `dates` holding the `proposed` and `archived`
  `DatedFact`s, and `tasks` holding `done` and `total` or `null` where
  there is no `tasks.md`) and `readChangeSpans(root)`, which returns one
  span per active and archived change, `readAt`, and the
  `archiveDatesUnreadableLines` of its archive read.
- [ ] 1.2 `readChangeSpans` reads the proposal dates with one
  `git log -c core.quotePath=false --no-renames --diff-filter=A
  --name-only` over the two globs `openspec/changes/*/proposal.md` and
  `openspec/changes/archive/*/proposal.md`, keyed by the change's name
  without its archive prefix, oldest add winning. Not `--follow`, which
  cannot be asked for two paths at once, and not one call per change,
  which is the 62 seconds this exists to avoid.
- [ ] 1.3 `readChangeSpans` takes the archived dates from
  `readArchiveCommitDates(root)` and assembles every fact through
  `buildChangeDates`, so a source word means what it means in
  `getChangeTimeline`. It SHALL NOT re-derive a date from a folder name
  itself.
- [ ] 1.4 `readChangeSpans` counts tasks with `countTaskCheckboxes` over
  each change's `tasks` artifact, read through `mapBounded` at
  `CHANGES_READ_AT_ONCE`; a change whose artifact is missing or unreadable
  carries `tasks: null` and does not fail the pass.
- [ ] 1.5 `packages/core/src/change-spans.test.ts` covers, against a git
  fixture: every change returned with both dates and its counts; an
  archived change dated from the archiving commit; a change with no commit
  carrying an absent proposed date with source `none`; a workspace with no
  git returning every change with absent dates; and a change whose
  directory was renamed after its proposal, dated from the add at its
  current path.
- [ ] 1.6 `packages/core/src/change-timeline.ts`'s `getChangeTimeline`
  reads only the change it was asked for —
  `discoverOpenSpecWorkspace(root, { changes: archived ? "archived" :
  "active", names: [changeName] })` — instead of the whole workspace per
  change. 585 ms per change against 264 changes is the greater half of the
  charts' read (the-pipeline-reads-each-workspace-once).
- [ ] 1.7 `packages/core/src/change-timeline.test.ts` asserts that reading
  one change's timeline asks the workspace for that change by name and for
  that list only, with the module's `discoverOpenSpecWorkspace` mocked, and
  that the timeline it returns is unchanged.
- [ ] 1.8 `packages/core/src/index.ts` exports `readChangeSpans` and its
  types; `packages/core/src/browser.ts` exports the `ChangeSpan` type only,
  since the read is a Node one.

## 2. The geometry and the wording are core's

- [ ] 2.1 A new `packages/core/src/change-comparison.ts` exports
  `COMPARISON_PERIODS` — `2-days`, `5-days`, `2-weeks`, `all`, each with
  the label the segmented control shows — and `comparisonWindow(period,
  spans, now)`, returning the window's first and last instant and one
  `ComparisonDay` per local day with its heading, its weekday, and whether
  it is a weekend. `all` starts at the earliest proposed day, or today
  where nothing carries one.
- [ ] 2.2 `change-comparison.ts` exports `comparisonRows(spans, window,
  now, filter?)`: one row per change whose span meets the window, ordered
  by when it was proposed and then by name, each carrying `from` and `to`
  as percentages of the window, `clippedStart`/`clippedEnd`, `active`, the
  change's name without its archive prefix, and its label — `"47 tasks"`
  archived, `"25 / 27"` active, `"no tasks"` where there is no list.
- [ ] 2.3 A row whose change carries no proposed date is returned with
  `bar: null` rather than dropped, and an active change's `to` is now.
  `filter` narrows by a case-insensitive substring of the change's
  directory name, so an archived change is found by its date prefix too.
- [ ] 2.4 `change-comparison.ts` exports `nowOffset(window, now)` (the
  dashed line's percentage, or `null` when now is outside the window),
  `labelSide(row)` (`"after"`, or `"before"` for a bar ending past 80% that
  starts past 20%), and `describeComparison(rows, window)` — "25 changes
  between Sat 12 Sep and today · each bar runs from proposed to archived".
- [ ] 2.5 The module is pure and imports nothing from Node;
  `packages/core/src/browser.ts` exports all of it, as it exports
  `change-layout.ts`.
- [ ] 2.6 `packages/core/src/change-comparison.test.ts` covers each export
  with dates built from local-time constructors: each period's day count,
  weekends marked, `all` over a span of months, a bar's percentages, a bar
  clipped at each edge, an active bar ending at now, the three labels, a
  change with no dates, the filter, and the sentence.

## 3. The screen

- [ ] 3.1 A new `packages/webui/src/components/ChangeComparisonView.tsx`
  draws the panel: a heading row with the "Change" column and one heading
  per day, weekend columns shaded, and one row per `ComparisonRow` with its
  name, its bar positioned from `from`/`to`, and its label on the side
  `labelSide` gives.
- [ ] 3.2 The view draws the dashed line for `nowOffset` across the rows,
  and the footnote "The dashed line is now. Sat and Sun are shaded. Click a
  row to open that change's own timeline."
- [ ] 3.3 Each row is a `<button>` whose accessible name is the change's
  name, whether it is active or archived, its proposed and archived
  moments as words, and its label; activating it calls the view's
  `onOpenChange(changeName, archived)`. The bar and the label are
  `aria-hidden`, since they repeat what the name says.
- [ ] 3.4 The view's toolbar draws the period as a segmented control with
  `aria-pressed`, the filter as a search field labelled "Filter changes"
  with the matched count beside it, and the legend naming archived and
  active.
- [ ] 3.5 The view draws the charts under the grid from the `timelines` it
  is given, and the note it is given while they are being read; where the
  host reports a failure it draws that sentence instead. A change with no
  timeline yet is simply not in the charts.
- [ ] 3.6 A new `packages/webui/src/components/ChangeComparisonView.test.tsx`
  asserts: one row per change, a bar's `--from`/`--to`, the now line, a
  row's accessible name and its click, the period control's pressed state,
  the filter's count, the legend, the footnote, the charts' note while
  reading and the charts once given.
- [ ] 3.7 `packages/webui/src/shell-ui.ts` draws the screen from tokens
  only: the panel and its heading row, the sticky name column, the day
  columns with `--comparison-day` as their minimum width, the weekend
  shading, the bars in `--steel` and `--cobalt` with the active one fading
  at its end, the cut edges square, the now line in `--crimson`, the row
  hover and focus, and the toolbar's legend.
- [ ] 3.8 `packages/webui/src/shell-ui.ts`'s VS Code layer maps every token
  the screen adds onto an editor theme colour, and
  `vscode-metro-mapping.test.ts` passes with no token left unmapped.
- [ ] 3.9 `packages/webui/src/components/MultiChangeTimelineView.tsx`, its
  test, its `.openspec-multi-timeline-*` rules and the
  `--multi-timeline-name`/`--multi-timeline-day` tokens are deleted; no
  import of it remains in `standalone-entry.tsx` or `timeline-entry.tsx`.

## 4. The standalone tab

- [ ] 4.1 `packages/server/src/rest.ts` gains
  `handleChangeSpansRequest`, which authorizes `cwd` the way
  `handleChangeTimelinesRequest` does and returns `readChangeSpans(cwd)`;
  `packages/server/src/server.ts` routes `POST /api/change-spans` to it.
- [ ] 4.2 `packages/server/src/rest.test.ts` asserts the route returns the
  spans for a workspace, and rejects a `cwd` the policy does not allow.
- [ ] 4.3 `packages/webui/src/change-timeline-client.ts` exports
  `loadChangeSpans(request, cwd)` over that route, with the same error
  handling as its neighbours.
- [ ] 4.4 `packages/webui/src/standalone-entry.tsx` reads the spans when
  the comparison mode is entered and when the workspace root changes,
  drawing `ChangeComparisonView`; the range fields, the selection list and
  the Load comparison button go from that mode. The sprint report mode
  keeps all three.
- [ ] 4.5 The tab holds the period and the filter as state, passes `now`
  read at each read, and opens a row's change by switching to "One change",
  selecting it and loading it, as choosing it in the picker does.
- [ ] 4.6 The tab requests the histories of the rows shown through
  `loadChangeTimelines`, keeping what it has already loaded in a map keyed
  by `archived:name`, requesting only what is missing, and ignoring a reply
  from a superseded request the way `timelineReading` does.
- [ ] 4.7 `packages/webui/src/tab-readings.ts` says
  "Reading when every change was proposed and archived…" while the spans
  are read, and `tab-readings.test.ts` covers it; the comparison's old
  "Reading the history of N changes from git…" goes with the selection it
  counted.
- [ ] 4.8 The page head for the comparison reads "Timeline" above "Compare
  changes", with `describeComparison`'s sentence under it.

## 5. The editor

- [ ] 5.1 `packages/extension/src/webview/timeline-panel.ts` gains
  `showComparison({ spans })`, embedding the spans under
  `__OPENSPEC_UI_COMPARISON__`, and listens for the webview's
  `read-timelines` and `open-timeline` messages through handlers its caller
  passes in.
- [ ] 5.2 `packages/webui/src/timeline-entry.tsx` draws
  `ChangeComparisonView` from that global, posts `read-timelines` for the
  rows shown through `acquireVsCodeApi`, and draws what comes back on
  `timelines`; a `timelines-failed` message becomes the charts' failure
  sentence.
- [ ] 5.3 `packages/extension/src/commands.ts`'s
  `openspec-ui.showAllChangesTimeline` reads `readChangeSpans` and opens
  the comparison with no quick pick; `pickChangesForTimeline` stays only
  for the sprint report, and `computeDefaultRange` goes.
- [ ] 5.4 The command answers `read-timelines` with `getChangeTimelines`
  for the entries asked for, passing the audit timestamps it already reads,
  and answers `open-timeline` by opening that change's timeline panel with
  the configured stale threshold.
- [ ] 5.5 `packages/extension/src/commands.test.ts` asserts the command
  opens the comparison without prompting, that a failed read shows an error
  and opens no webview, and that the two messages reach `getChangeTimelines`
  and the timeline panel.
- [ ] 5.6 `packages/extension/src/webview/timeline-panel.test.ts` asserts
  the comparison payload is embedded behind the CSP nonce and that the
  panel's message listener is wired.

## 6. The pictures and the browser suite

- [ ] 6.1 `packages/server/e2e/fixtures/create-dated-workspace.ts` accepts
  an hour for each change's proposal and archive commits and a task list of
  a given size, so a fixture can draw bars of different lengths in one day.
- [ ] 6.2 `packages/server/e2e/frame-screenshots.spec.ts` opens the
  comparison against that fixture with the clock fixed, asserts the day
  headings, one row's label and the now line, and writes
  `timeline-compare-light.png` and `timeline-compare-dark.png` at 1280
  pixels.
- [ ] 6.3 `packages/server/e2e/change-charts.spec.ts` reaches the charts
  through the new screen — choose "Compare changes", then "All" — and keeps
  its assertions on the per-day table, the basis sentence and the
  work-duration note.
- [ ] 6.4 `docs/images/standalone/` gains the two new pictures and
  `npm run lint:screenshots` counts them.

## 7. Checks

- [ ] 7.1 `npm run typecheck && npm run lint && npm run test` passes,
  run unpiped. Record each package's test count.
- [ ] 7.2 A changeset written with the implementation:
  `@openspec-ui/core` minor, `@openspec-ui/webui` minor,
  `@openspec-ui/server` minor, `openspec-ui-vscode` patch.
- [ ] 7.3 `lint:english` after `git add`, `lint:changesets`,
  `lint:test-budgets`, `lint:source-text` and `lint:screenshots` pass.
- [ ] 7.4 The whole standalone browser suite passes, not only the specs
  this change touches. Record the count.
- [ ] 7.5 **Delegated to claude-cli.** Live: the comparison against this
  repository on a server run from this branch, in both themes, at each of
  the four periods; and the editor's panel in the Extension Development
  Host, where a row opens that change's timeline. Evidence to record: the
  row count and the sentence at each period, the time from choosing the
  mode to the grid being drawn and to the charts arriving, and the
  screenshot paths.
- [ ] 7.6 **Human-only.** Whether the screen matches the mockup's
  "Timeline: compare changes" artboard in both hosts, and whether the grid
  reads at a year's width — the part of `the-web-ui-screens-wear-metro`
  6.7 the owner left open.
