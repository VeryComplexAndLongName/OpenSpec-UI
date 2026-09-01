# @openspec-ui/webui

## 1.17.2

### Patch Changes

- 6b13d58: The AI panel now reads the OpenSpec change list automatically once it has a usable working directory, so the change picker is populated the moment the panel opens. Previously "Load changes" was an unlabelled precondition: until it was clicked the picker stayed empty and disabled, which blocked every command that needs a selected change. The button remains, relabelled "Reload changes", because changes can still appear on disk while the panel is open. Only the read-only `list` command is auto-run, never `plan`/`review`/`implement`, and the auto-read is skipped while another run is in flight so its output is not discarded.
- Updated dependencies [6b13d58]
- Updated dependencies [d9084ab]
- Updated dependencies [db0e717]
- Updated dependencies [6b13d58]
  - @openspec-ui/core@0.34.0

## 1.17.1

### Patch Changes

- Updated dependencies [5ce55ae]
  - @openspec-ui/core@0.33.2

## 1.17.0

### Minor Changes

- be47425: Make the Agentic Harness's `semi-autonomous`/`autonomous` autonomy levels
  functional. A new `"chain"` command runs `propose -> review -> apply ->
  archive` for a change in sequence, pausing at an explicit `checkpoint`
  between stages by default (`semi-autonomous`) or continuing immediately via
  `stageCompleted` (`autonomous`, or a per-change `harness.json` setting
  `checkpoints.requireConfirmationBetweenSteps: false`). `autonomous` is
  reachable only through an explicit per-change `openspec/changes/<id>/
  harness.json` — never the global `openspec/agent-harness.json`, and never
  implied by any other setting.
  
  See `docs/adr/0012-agentic-harness-chain-execution-protocol.md` and
  `openspec/changes/agentic-harness-autonomy/` for the full design. A chain
  always stops after `archive` and never invokes the `git` stepAgent —
  commit/push automation remains fully out of scope, deferred to its own
  future change. The "Run with Agentic Harness" UI entry point that starts a
  chain from either delivery target is also a separate, dependent follow-up
  (`openspec/changes/agentic-harness-run-menu/`); this release only adds the
  protocol and a minimal, not-yet-wired-up `HarnessChainPanel` component.

### Patch Changes

- be47425: Add a discoverable "Run with Agentic Harness" entry point for the chain
  execution `agentic-harness-autonomy` introduced: a new context-menu command
  (`openspec-ui.runWithHarness`) in the VS Code extension, and a matching
  button in the standalone shell's Change Editor tab. Both resolve the
  selected change's Agentic Harness configuration fresh on every invocation
  and dispatch accordingly — the existing Agent Selection picker for
  `assisted`, or the `HarnessChainPanel` chain view for `semi-autonomous`/
  `autonomous` — without ever overriding what that configuration says.
  
  See `openspec/changes/agentic-harness-run-menu/` for the full design. No
  protocol change — this is purely a discoverable trigger over what
  `agentic-harness-autonomy` already exposes.
- Updated dependencies [be47425]
- Updated dependencies [be47425]
  - @openspec-ui/core@0.32.0

## 1.16.0

### Minor Changes

- 3a93782: Add the Agentic Harness (assisted level): a two-level (global +
  per-change), product-owned config that recommends a CLI agent per
  OpenSpec-change stage in the Agent Selection picker, and shows which
  agent ran a process plus its percent-complete in the Processes view.
  Configurable via a new "Harness Settings" GUI in both delivery targets.
  
  See `docs/adr/0011-agentic-harness-config-and-autonomy-levels.md` and
  `openspec/changes/agentic-harness/` for the full design. Only the
  `assisted` autonomy level is functional in this release —
  `semi-autonomous`/`autonomous`/the `git` stepAgent action/parallel task
  execution are accepted in the config schema for forward compatibility
  but not yet implemented, and are visibly marked as such in the Harness
  Settings UI.
- cc7fc8a: `ChangesList` and `ArchiveList` now show a task-completion percentage
  alongside the existing fraction, and both show a change's last-modified
  date (previously `ChangesList` didn't show it, and `ArchiveList` didn't
  show task progress at all).
- da70d78: Standalone app's "OpenSpec view summary" tab now renders active and
  archived changes as searchable lists (by name or status), using the
  shared `ChangesList`/`ArchiveList` components instead of a static table;
  archived changes now show real task progress and a last-modified date.
- 47b2fc4: `TabPanel` gains an opt-in `lazy` prop that defers a tab's first mount
  until the user opens it, instead of mounting on app load; applied to all
  of the standalone shell's top-level tabs, closing an eager-fetch gap
  where the Processes and Recovery tab loaded its data before ever being
  opened.
- fcd2f15: `ChangesList`/`ArchiveList` now render inside a height-bounded, scrollable
  container — so the search box no longer scrolls out of view on long
  lists — and switch to windowed DOM rendering above 50 items, keeping the
  live DOM node count bounded regardless of how many changes a repository
  has archived.

### Patch Changes

- Updated dependencies [3a93782]
- Updated dependencies [da70d78]
  - @openspec-ui/core@0.31.0

## 1.15.0

### Minor Changes

- Add a downloadable sprint summary PDF report: for a user-picked date
  range and set of changes, who authored each one (from git), what it
  was, task completion, plus aggregate statistics (total changes, tasks
  completed in range, a per-author breakdown). New "Sprint report" mode
  in the standalone Timeline tab.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.29.0

## 1.14.0

### Minor Changes

- Add stale-pending-task detection: a pending task untouched (per git
  blame) longer than a configurable threshold (default 14 days) is now
  flagged in the Change Timeline view. Configurable via a number input in
  the standalone Timeline tab and the new `openspec-ui.staleTaskThresholdDays`
  VS Code setting.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.28.0

## 1.13.0

### Minor Changes

- Add a "compare changes" timeline: a new global command
  (`openspec-ui.showAllChangesTimeline`) and a standalone Timeline-tab
  mode that show several changes as parallel lanes on a shared,
  log-scaled time axis (verified against real archived-change data
  before choosing the log-scale direction). Also adds the CSS the
  single-change timeline view needed but was missing, and fixes archived
  dates plotting before same-day created/task timestamps.

## 1.12.0

### Minor Changes

- Add a "Show Change Timeline" context-menu command (active and archived
  changes) and a standalone "Timeline" tab: proposal/design/spec content
  followed by tasks positioned by best-effort git-derived completion
  date, with pending/undated tasks shown distinctly. The extension
  computes the timeline directly (no HTTP, no message bridge) and opens
  it in a new webview tab per change.

## 1.11.0

### Minor Changes

- Add a best-effort, git-derived change timeline data layer: created date,
  archived date, and a per-task completion date (via `git blame` on
  `tasks.md`, `null` for still-pending tasks), plus proposal/design/spec
  content in one read. New `getChangeTimeline`/`getChangeTimelines` in
  `@openspec-ui/core`, `POST /api/change-timeline`/`/api/change-timelines`
  in the standalone server, and a matching webui client. No UI yet — this
  is the shared data layer for a "change timeline" view, coming next.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.27.0

## 1.10.0

### Minor Changes

- Notify when a `plan`/`implement`/`review` run finishes while you're not
  watching the Processes view or the AI panel. The VS Code extension shows a
  native notification (with a "View" action that opens the Process
  Dashboard); the standalone app shows a browser notification, once
  permission is granted. `status`/`list`/`show`/`validate` (near-instant) and
  `cancelled`/`interrupted`/`rolled-back` runs are not notified.
