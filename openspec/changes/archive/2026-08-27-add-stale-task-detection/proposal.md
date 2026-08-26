## Why

Following up on the 2026-08-26 product-direction discussion: a pending
task that has sat untouched for a long time in an active change is a
useful signal that it may have been forgotten. The data needed for this
already exists — `blameLineDates` (from
`2026-08-26-add-change-timeline-data-layer`) already computes a
per-line last-touched date via git blame; it just wasn't exposed for
still-pending tasks (`ChangeTimelineTask.date` is deliberately `null`
for those, since a "last touched" date would misleadingly read as a
completion date — see that change's design.md).

## What Changes

- Add `ChangeTimelineTask.lastTouchedDate`: always populated from blame
  (done or not), distinct from `date` (completion-only). No new git
  calls — reuses the blame map `getChangeTimeline` already computes.
- Add `packages/core/src/stale-tasks.ts`: `isTaskStale`/`findStaleTasks`,
  pure date-math functions (no git/fs access) — a pending task is stale
  when `lastTouchedDate` is older than a threshold (default 14 days,
  `DEFAULT_STALE_TASK_THRESHOLD_DAYS`). Exported from both the Node-only
  barrel and the browser-safe barrel, since it has no Node dependency
  and both delivery targets need it.
- `packages/webui/src/change-timeline-client.ts` now re-exports the
  `ChangeTimeline*` interfaces from `@openspec-ui/core/browser` instead
  of hand-duplicating them — the hand-duplicated copy had already
  drifted out of sync once (missing this exact new field) before this
  module started importing the real ones.
- `ChangeTimelineView.tsx` gains a `staleThresholdDays` prop (default
  14) and flags stale pending tasks distinctly (a warning marker/color,
  not just plain "pending").
- Standalone app: a "Stale after (days)" number input next to the
  single-change Timeline picker.
- VS Code extension: a new setting,
  `openspec-ui.staleTaskThresholdDays` (default 14), read when
  `openspec-ui.showChangeTimeline` fetches the timeline and passed to
  the webview alongside the `ChangeTimeline` payload (its own global,
  `window.__OPENSPEC_UI_STALE_THRESHOLD_DAYS__`, embedded the same
  nonce'd way as the timeline data itself — see
  `2026-08-26-fix-timeline-webview-csp-inline-script`).
- Not changed: the multi-change comparison view — it does not currently
  plot pending tasks at all, so staleness has nothing to attach to
  there yet. Out of scope for this change.

## Capabilities

### Modified Capabilities

- `execution-core`: adds a Requirement for stale-pending-task detection.
- `vscode-extension`: the Change Timeline webview now surfaces stale
  tasks, configurable via a new setting.
- `standalone-app`: the Timeline tab gains a configurable staleness
  threshold.

## Impact

- `packages/core/src/change-timeline.ts`, `browser.ts`, `index.ts`
- `packages/core/src/stale-tasks.ts` (new)
- `packages/webui/src/change-timeline-client.ts`
- `packages/webui/src/components/ChangeTimelineView.tsx`
- `packages/webui/src/standalone-entry.tsx`, `timeline-entry.tsx`,
  `shell-ui.ts`
- `packages/extension/src/webview/timeline-panel.ts`
- `packages/extension/src/commands.ts`, `package.json`
- `.changeset/*.md` (new changeset file)
