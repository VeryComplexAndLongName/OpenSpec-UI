## Why

Third and final change building the "change timeline" feature (see
`2026-08-26-add-change-timeline-data-layer` and
`2026-08-26-add-change-timeline-view`). This adds Phase 2: a global
"compare changes" view showing several changes in parallel lanes on a
shared, log-scale time axis with a date-range picker — confirmed
explicitly by the user, including the log-scale requirement, and
verified empirically against this repository's own real archived-change
timestamps before implementation (see design.md, "Log-scale direction").

## What Changes

- Add `packages/webui/src/timeline-scale.ts` (`logPosition`): a
  log1p-from-range-start position function, 0-100, clamped. Validated
  against real data: this direction spreads a dense cluster of
  near-simultaneous changes (this project's own squash-merge workflow
  produces exactly this) into something readable; the opposite
  direction (log from the range end) made the same cluster *more*
  overlapped than a plain linear scale.
- Add `packages/webui/src/components/MultiChangeTimelineView.tsx`: one
  lane per selected change, plotting created/task/archived points along
  the shared axis. Reuses Change 1's `getChangeTimelines` batch
  function and Change 2's `ChangeTimeline` type unchanged — no changes
  to the data layer.
- Standalone app: a "Single change" / "Compare changes" mode toggle
  within the existing Timeline tab (not a new tab) — a date-range
  picker plus a multi-select change list, calling `loadChangeTimelines`
  via real REST.
- VS Code extension: a new global command,
  `openspec-ui.showAllChangesTimeline` (Command Palette only, no tree
  item — matching the `openspec-ui.openspecView` precedent), with a
  multi-select `showQuickPick` over active and archived changes. The
  date range is derived automatically from the selected changes' own
  data (earliest/latest determinable date) rather than asking the user
  to type ISO dates, since VS Code's prompt UI has no native date
  picker.
- `TimelineWebviewPanel` gains `showMulti(...)`, reusing the same
  not-a-singleton, embed-the-data-in-initial-HTML approach as `show()`
  (Change 2); `timeline-entry.tsx` renders whichever of
  `window.__OPENSPEC_UI_TIMELINE__` / `__OPENSPEC_UI_MULTI_TIMELINE__`
  is present.
- Add CSS for both this change's and Change 2's timeline classes to
  `packages/webui/src/shell-ui.ts` — a real gap found during this
  change's own verification: the positioned-dots-on-an-axis layout is
  the actual point of the feature, and it did not render as a
  positioned axis at all without `position: relative`/`absolute` rules,
  which had never been added.
- Fix: an archived change's `archivedDate` (a plain calendar date, no
  time-of-day) was anchored to midnight when computing plot positions
  and default ranges, which could sort it *before* that same day's real
  created/task timestamps — since archiving is chronologically last,
  it is now anchored to end-of-day instead.

## Capabilities

### Modified Capabilities

- `vscode-extension`: adds a Requirement for the global comparison
  command.
- `standalone-app`: adds a Requirement for the compare-changes mode.

## Impact

- `packages/webui/src/timeline-scale.ts` (new)
- `packages/webui/src/components/MultiChangeTimelineView.tsx` (new)
- `packages/webui/src/standalone-entry.tsx`
- `packages/webui/src/timeline-entry.tsx`
- `packages/webui/src/shell-ui.ts`
- `packages/extension/src/webview/timeline-panel.ts`
- `packages/extension/src/commands.ts`, `package.json`
- `.changeset/*.md` (new changeset file)
