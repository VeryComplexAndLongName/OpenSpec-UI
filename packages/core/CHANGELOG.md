# @openspec-ui/core

## 0.33.0

### Minor Changes

- b21d2f4: Fix `prepareAgentContext` sending an effectively empty prompt to every
  `plan`/`review`/`implement` run (single-stage or as part of a `"chain"`)
  for every agent, since the product first shipped: it now actually reads
  and embeds the change's real `proposal.md`/`design.md`/`tasks.md` and any
  delta-spec content under the run's `changeDir`, instead of relying on a
  `promptContext` field that no caller has ever populated. Also adds an
  explicit instruction to work only within the named change directory, as
  additional insurance against an agent wandering to a different
  `openspec/changes/<id>/` directory than the one it was asked about — found
  live when a `copilot-cli` `implement` run picked a different change to
  work on than the one actually selected.
  
  See `openspec/changes/agent-prompt-context/` for the full diagnosis and
  fix. No change to the allowlist/cwd-sandbox/audit security boundary —
  `prepareAgentContext` still cannot affect what gets run or where.

## 0.32.0

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

## 0.31.0

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
- da70d78: Standalone app's "OpenSpec view summary" tab now renders active and
  archived changes as searchable lists (by name or status), using the
  shared `ChangesList`/`ArchiveList` components instead of a static table;
  archived changes now show real task progress and a last-modified date.

## 0.30.0

### Minor Changes

- Add a cross-host workspace lease (docs/adr/0010-cross-host-workspace-lease.md) so at most one host process — a VS Code extension or a standalone server, pointed at the same workspace — can run a mutating operation at a time. A blocked host gets an immediate, actionable error naming the other host instead of racing it or queuing forever. The standalone server's own `implement` execution is now routed through the same mutation lock and lease (it previously bypassed the scheduler entirely), closing a pre-existing same-host gap alongside the cross-host one.

## 0.29.0

### Minor Changes

- Add a downloadable sprint summary PDF report: for a user-picked date
  range and set of changes, who authored each one (from git), what it
  was, task completion, plus aggregate statistics (total changes, tasks
  completed in range, a per-author breakdown). New "Sprint report" mode
  in the standalone Timeline tab.

## 0.28.0

### Minor Changes

- Add stale-pending-task detection: a pending task untouched (per git
  blame) longer than a configurable threshold (default 14 days) is now
  flagged in the Change Timeline view. Configurable via a number input in
  the standalone Timeline tab and the new `openspec-ui.staleTaskThresholdDays`
  VS Code setting.

## 0.27.0

### Minor Changes

- Add a best-effort, git-derived change timeline data layer: created date,
  archived date, and a per-task completion date (via `git blame` on
  `tasks.md`, `null` for still-pending tasks), plus proposal/design/spec
  content in one read. New `getChangeTimeline`/`getChangeTimelines` in
  `@openspec-ui/core`, `POST /api/change-timeline`/`/api/change-timelines`
  in the standalone server, and a matching webui client. No UI yet — this
  is the shared data layer for a "change timeline" view, coming next.

## 0.26.0

### Minor Changes

- Add an archive-time Changesets reminder to the VS Code extension. When a
  workspace has adopted Changesets (`.changeset/config.json` exists) and no
  changeset is currently pending, archiving a change now offers to run
  `npx changeset` in an integrated terminal. Silent for workspaces that
  have not adopted Changesets, and never affects the archive operation's
  own result.

## 0.25.0

### Minor Changes

- Add a new built-in template, `adopt-changesets` (category
  `release-management`), for proposing Changesets adoption in an npm
  workspaces monorepo from an OpenSpec change. It bakes in the
  `privatePackages` configuration gotcha discovered adopting Changesets in
  this repository, and a verification step that confirms a real changeset
  actually changes a version and changelog rather than trusting a clean
  exit code.
