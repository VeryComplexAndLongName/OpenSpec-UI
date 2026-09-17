## Why

ADR 0033 decision 4 draws the Timeline in two screens. The one-change
screen was delivered by `the-change-timeline-looks-like-the-mockup`, which
left the other one out with its reason written down: "Compare changes comes
next as its own change, since it needs a faster read of dates."

The comparison the mockup draws — one row per change, one column per day, a
bar from the hour a change was proposed to the hour it was archived — is
also the answer the owner is still owed. `the-web-ui-screens-wear-metro`
6.7 asked whether the multi-change grid reads at a year's width; the owner
answered the rest of that question on 2026-09-17 and said of this part that
it is "Timeline's Compare changes over a year's range, which I had not
found".

What stands in the way is on both sides of the screen:

- **It asks the reader to do the work first.** Today's mode is two date
  fields and a multiple-selection list of every change — 264 of them in
  this repository — and a Load comparison button. Nothing is shown until
  the reader has picked both a range and a set of changes, which is the
  question they came to ask.
- **Reading the dates takes a minute.** Dating one change costs a
  `git log --follow` of its `proposal.md`: measured on this repository on
  2026-09-17, 62 seconds for 264 changes. One `git log` over
  `openspec/changes/*/proposal.md` answers all of them in 209 ms, and
  agreed with the per-change read on 262 of the 264 (the two differ by
  minutes within the same day, where the change was renamed after it was
  proposed).
- **A point is not a span.** The grid draws a marker per event, so how long
  a change ran — the thing a comparison is for — has to be reconstructed by
  eye from two markers on one row.

## What Changes

- **Compare changes shows every change at once, and asks nothing first.**
  Entering the mode reads the whole workspace's dates in one pass and draws
  it.
- **The period is a segmented control** — 2 days, 5 days, 2 weeks, All —
  and All runs from the earliest proposed date to today.
- **Each change is a bar** from when it was proposed to when it was
  archived, drawn in the day column and at the hour it happened. An active
  change's bar runs to a dashed line marking now and fades into it.
  Archived bars carry the steel of an archived change, active bars the
  cobalt of a running one, and a legend names both.
- **A bar carries its figures**: an archived change's total task count, an
  active change's done-of-total.
- **Weekend columns are shaded**, and the day headings name the days.
- **Changes are found by typing part of a name**, as the one-change picker
  already allows, and the count says how many of how many match.
- **A row opens that change's own timeline** — the one-change screen in the
  standalone shell, a timeline panel in the editor.
- **The charts stay**, drawn under the grid for the changes the grid shows,
  and read after it: the grid is on screen while its histories are still
  being read.
- **The editor's comparison command stops asking which changes to compare**
  and opens the same screen over the whole workspace.
- **Core learns to date every change in one pass**, with each date carrying
  its source exactly as the per-change read does.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-workbench`: every change's proposed and archived dates, and its
  task counts, are readable in one pass over the workspace.
- `standalone-app`: what the Timeline tab's comparison shows, and that it
  needs no selection.
- `vscode-extension`: the comparison command opens over every change rather
  than over a quick-picked set.

## Impact

- **`packages/core`**: a new `src/change-spans.ts` (the one-pass read) and
  `src/change-comparison.ts` (the pure geometry and wording, exported from
  the browser barrel), each with its test; `src/change-timeline.ts` reads
  only the change it is asked about, instead of the whole workspace per
  change.
- **`packages/server`**: a `POST /api/change-spans` route over
  `readChangeSpans`.
- **`packages/webui`**: a new `src/components/ChangeComparisonView.tsx`
  with its test, replacing `MultiChangeTimelineView.tsx`; the Timeline
  tab's comparison mode in `src/standalone-entry.tsx`; the styles in
  `src/shell-ui.ts`; `src/timeline-entry.tsx`.
- **`packages/extension`**: `src/commands.ts`'s comparison command;
  `src/webview/timeline-panel.ts` gains the two messages the screen needs —
  read these changes' histories, and open this change's timeline.
- **`packages/server/e2e`**: `frame-screenshots.spec.ts` captures the
  screen in both themes; `change-charts.spec.ts` reaches the charts the new
  way.
- **Unchanged**: the one-change screen, the sprint report and its command,
  what a date means and where it is read from, and the charts themselves.
