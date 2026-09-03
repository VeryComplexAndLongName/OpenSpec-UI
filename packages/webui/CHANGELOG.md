# @openspec-ui/webui

## 1.23.3

### Patch Changes

- 4e59bdf: `stepAgents` no longer accepts a `git` entry, joining `archive` — the
  `git` stage runs its own push/pull-request/merge sequence and invokes no
  CLI agent, so there was never anything for a `stepAgents.git` entry to
  configure. `HarnessStepAgentStage` now excludes both stages; a
  `stepAgents.git` entry from before this restriction existed is read and
  dropped with a warning naming the file, not rejected.
  
  The standalone settings surface (`HarnessSettingsView.tsx`) now renders
  `git` the same way it already renders `archive`: listed, with no agent,
  effort or budget picker. Previously it offered a picker for an agent id
  that `HarnessChainRunner` never read.
- Updated dependencies [4e59bdf]
- Updated dependencies [4e59bdf]
  - @openspec-ui/core@0.48.0

## 1.23.2

### Patch Changes

- Updated dependencies [eca84bc]
- Updated dependencies [d161b50]
  - @openspec-ui/core@0.47.0

## 1.23.1

### Patch Changes

- Updated dependencies [348ee61]
- Updated dependencies [348ee61]
  - @openspec-ui/core@0.46.0

## 1.23.0

### Minor Changes

- 5271dfe: Add mechanical task checks to the harness's `verify` stage, and stop
  offering an agent for the mechanical `archive` stage.
  
  - New closed registry (`mechanical-checks.ts`) of named checks
    (`validate-change`, `typecheck`, `test`, `lint`, `path-unchanged`,
    `changeset-present`) a `tasks.md` task line may declare via a
    `` `check(name[, param])` `` inline-code span.
  - The `verify` chain stage now runs every declared check before invoking
    its agent: a failing check skips the agent entirely and names which
    checks failed; a passing check marks its own task `[x]` and is
    summarized in the agent's prompt so it is not re-run. An agent's own
    report never marks a task that carries a check.
  - `stepAgents` no longer accepts an `archive` entry — `archive` is a real
    stage but a mechanical one, invoking no agent. A configuration that
    already sets `stepAgents.archive` is read with that entry dropped and a
    warning, not rejected.
  - `HarnessSettingsView` (webui) and the extension's change-template wizard
    (`commands.ts`) still show `archive` as part of the stage sequence, but
    no longer offer an agent or model picker for it.

### Patch Changes

- Updated dependencies [5271dfe]
  - @openspec-ui/core@0.45.0

## 1.22.0

### Minor Changes

- 366bb77: Add the harness `git` stage, and make `verify` run mechanical checks itself.
  
  - The `git` stage pushes, opens a pull request and merges, only under a
    per-change `reviewGate.mode: "agent-sufficient"` plus a per-change
    remote/branch allowlist. Every action is checked against that allowlist
    and audited, blocked attempts included.
  - The merge waits for the pull request's checks and refuses one whose
    checks have not passed. Not configurable, and an absent or all-skipped
    result is a refusal rather than permission (ADR 0014).
  - `verify` runs the mechanical checks a `tasks.md` declares before its
    agent. A failing check skips the agent entirely; a passing one marks its
    own task, and an agent's report can no longer mark a checked task.
  - `stepAgents` no longer accepts an `archive` entry — the stage is
    mechanical and invoked no agent. Existing configurations are read with
    that entry dropped and a warning, never rejected.

### Patch Changes

- Updated dependencies [366bb77]
  - @openspec-ui/core@0.44.0

## 1.21.0

### Minor Changes

- 8a69ea0: Implement harness config strictness for stage runner selection and validation.
  
  - Replace legacy `dispatch` usage in `stepAgents` with a dedicated `vscode-chat` step-runner id.
  - Refuse `model`, `effort`, and `budget` on chat-dispatched stages because those values cannot reach any CLI invocation.
  - Reject unknown keys in `stepAgents` entries and nested `budget` objects.
  - Migrate legacy `dispatch: "vscode-chat"` / `dispatch: "cli"` shapes on read and write.
  - Update core, webui, extension, and server runtime/test coverage for the new strict behavior.

### Patch Changes

- Updated dependencies [8a69ea0]
  - @openspec-ui/core@0.43.0

## 1.20.0

### Minor Changes

- 5cddc4d: Adds ACP (Agent Client Protocol, agentclientprotocol.com) support: a shared session driver in `@openspec-ui/core` speaks ACP JSON-RPC to whichever ACP-capable subprocess it is pointed at, and four new, additional agent adapters — `copilot-cli-acp`, `gemini-cli-acp`, `codex-cli-acp`, `claude-cli-acp` — translate an agent's structured `session/update` progress into the protocol's new `agentUpdate` event and, where the underlying agent genuinely supports it, `session/request_permission` into a new `permissionRequest` event, answerable by a new `resolvePermission` command. These are additive, separately selectable entries alongside today's five raw-text adapters — none of them change. `@openspec-ui/webui`'s AI panel renders `agentUpdate` content and shows an explicit Allow/Deny control for a `permissionRequest`; `claude-cli-acp`'s picker entry states up front that it provides progress detail only, with no permission gate (Claude's CLI has no documented interactive-permission callback in this mode). `openspec-ui-vscode` gains matching event descriptions for its own event log. `codex-cli-acp` depends on an externally installed `codex-acp` binary, detected on `PATH` like every other CLI this project already shells out to — never bundled as an npm dependency, to avoid pulling in `@openai/codex`'s native platform binary for every contributor regardless of use.

### Patch Changes

- Updated dependencies [5cddc4d]
  - @openspec-ui/core@0.42.0

## 1.19.2

### Patch Changes

- 144e13b: A workbench process can now suspend itself to wait on an external system without holding the workspace's mutation lock. `WorkbenchProcessState` gains `"suspended"`, and `WorkbenchProcess` gains an optional `waitingFor` reason. `ProcessExecutionContext` gains `suspend(reason, { timeoutMs })`, which releases the in-process mutation lock and, where a `WorkspaceLeaseManager` is configured, the cross-host lease too — letting another mutating process run in its place. `WorkbenchProcessScheduler.resumeProcess(id)` returns a suspended process to the queue (never directly to `"running"`, so two processes suspended at once still serialize), where it re-admits under the existing lock/lease rules. Every suspension is bounded: on timeout the process fails, naming what it waited for and for how long; cancelling a suspended process ends it as `"cancelled"` immediately. A suspended process persisted across a host restart is recovered as `"interrupted"`, matching `"queued"`/`"running"`, since the poller and the in-memory wait belonged to the host that is gone. New `external-waiter.ts` provides a generic, lock-free poller for a future consumer to build on. The Processes views in both the VS Code extension and the standalone webui render a suspended process as waiting, with its wait reason, distinctly from running. This ships the mechanism only — no stage in this repository suspends yet.
- Updated dependencies [144e13b]
  - @openspec-ui/core@0.41.0

## 1.19.1

### Patch Changes

- Updated dependencies [ed9e4c9]
  - @openspec-ui/core@0.40.0

## 1.19.0

### Minor Changes

- 80a097b: A `stepAgents` entry can now set a reasoning effort and a spending cap, resolved through the same global/per-change merge as `model`. `HarnessStepAgent`'s object form gains `effort?: HarnessEffort` and `budget?: { maxCostUsd?: number; maxAiCredits?: number }` — the spending cap stays in each agent's own unit rather than one shared field, since the CLIs do not share a unit. `HARNESS_AGENT_CAPABILITIES` (`packages/core/src/harness-step-agent.ts`) is the single table both `harness-config.ts`'s validator and each adapter read: `claude-cli` and `copilot-cli` render `--effort`/`--max-budget-usd`/`--max-ai-credits`; `codex-cli` renders `-c model_reasoning_effort="<level>"` and nothing for budget; `gemini-cli` has neither mechanism. A stage entry setting a value its agent cannot express is refused when the configuration resolves, naming the agent and the accepted values, rather than being silently ignored or failing minutes into a run. `default-runners.ts`'s allowlist matcher generalizes from a single optional `--model` pair to an ordered, closed set of validated optional pairs. The webui's Harness Settings view and the VS Code extension's per-change customization wizard both offer effort/budget per stage, limited to what that stage's selected agent accepts. An entry without the new fields produces a byte-identical command line to before this change.

### Patch Changes

- Updated dependencies [80a097b]
  - @openspec-ui/core@0.39.0

## 1.18.0

### Minor Changes

- 56a7c37: A run started from the AI panel can now be cancelled from it: a Cancel button next to Run appears while a run is in flight, sending a `cancel` command on the active `runId` through the same transport the run was started on — the only cancel affordance previously existed for `HarnessChainPanel`'s chain runs, unreachable at `autonomyLevel: "assisted"`, so a single-stage run (available at every autonomy level) could not be cancelled from the UI at all. `openspec-ui.cancelProcess`'s contributed title is renamed to "OpenSpec UI: Cancel Implementation Session" to say what it actually cancels — an implementation session via `deps.implementationSessions.cancel(...)`, not a harness run; its command id, `when` clause, and behavior are unchanged.

## 1.17.7

### Patch Changes

- Updated dependencies [d0be00e]
  - @openspec-ui/core@0.38.0

## 1.17.6

### Patch Changes

- Updated dependencies [8f60b09]
  - @openspec-ui/core@0.37.0

## 1.17.5

### Patch Changes

- dc71cec: Added a `verify` stage to the Agentic Harness chain, running after `apply` and before `archive`, per `docs/adr/0018-event-driven-harness-orchestration.md` gap 1. It reviews the implementation against `tasks.md` and the change's spec delta, and unchecks any task whose stated verification does not actually hold — the existing archive gate (which already refuses to archive a change with unchecked tasks) is what stops the chain, not a new outcome or gate.
  
  `CommandKind` gains an additive `"verify"` member; `commandInstruction("review")` is reworded to describe reviewing the change's proposal (its actual job at chain position 2), resolving the standing contradiction with its old "review the current implementation" wording. `HarnessStage`/`STAGES` gain `"verify"` between `"apply"` and `"archive"`; `HarnessChainRunner`'s `CHAIN_STAGES` and `determineStartStage()` are updated to match — a change whose tasks are all checked but isn't yet archived now resumes at `verify`, not `archive` directly. `stepAgents.verify` resolves through the same global/per-change merge as every other stage.
  
  `security.ts`'s `AgentPromptContextOptions` gains an optional `verifiedDelta` field; when present, `prepareAgentContext()` adds a labelled section carrying the verified run's changed files, truncated with a visible count if oversized, and never sourced from `GitWrapper.diff()` (which would leak a concurrent session's unrelated uncommitted work). `HarnessChainRunner` sources this from a checkpoint captured around the `apply` stage, best-effort — a chain with no delta available (or one that never captures a checkpoint) produces the exact same prompt as before this change.
  
  `packages/extension`/`packages/webui`: the hand-maintained stage lists in the per-change harness config wizard (`commands.ts`) and the Harness Settings view (`HarnessSettingsView.tsx`) now include `verify` in chain order.
- Updated dependencies [dc71cec]
  - @openspec-ui/core@0.36.0

## 1.17.4

### Patch Changes

- 6ed2d1a: Added accounting plumbing for a run's resource usage and observed agent version, and an optional cost/token budget for Agentic Harness chains.
  
  `AuditEntry` (security.ts) gains optional `usage`, `agentVersion`, and `changeDir` fields — all optional, so audit lines written before this change stay valid. `agent-detection.ts` now captures a best-effort agent version from the `--version` probe it already runs (no second spawn) via a new `detectAvailableAgentsDetailed()` export; the existing `detectAvailableAgents()` boolean-map contract is unchanged. New `agent-usage.ts` defines the adapter-agnostic `AgentUsage` shape; new `usage-report.ts` aggregates recorded usage by agent, by model, and by change, distinguishing unmeasured runs from zero cost. New `verified-agent-versions.ts` holds the single `claude` CLI version this project's structured-output parsing was verified against.
  
  `HarnessConfig` gains an optional `budget` (`maxCostUsd`/`maxTokens`); `HarnessChainRunner` checks it before starting each stage of a chain and refuses to continue once recorded usage reaches it, naming the budget as the reason. A run already in progress is never interrupted. `WorkbenchProcess` gains an optional `usage` field so a run's recorded cost can be shown in the Processes view (extension tree, webui table) when present — never as `$0.00` when absent.
  
  No adapter is changed by this commit: nothing yet produces `AuditEntry.usage`, so the budget stays inert until a future change (`acp-agent-adapters`) adds a producer.
- Updated dependencies [6ed2d1a]
  - @openspec-ui/core@0.35.0

## 1.17.3

### Patch Changes

- Updated dependencies [d15f4cb]
  - @openspec-ui/core@0.34.1

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
