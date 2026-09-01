# @openspec-ui/core

## 0.36.0

### Minor Changes

- dc71cec: Added a `verify` stage to the Agentic Harness chain, running after `apply` and before `archive`, per `docs/adr/0018-event-driven-harness-orchestration.md` gap 1. It reviews the implementation against `tasks.md` and the change's spec delta, and unchecks any task whose stated verification does not actually hold — the existing archive gate (which already refuses to archive a change with unchecked tasks) is what stops the chain, not a new outcome or gate.
  
  `CommandKind` gains an additive `"verify"` member; `commandInstruction("review")` is reworded to describe reviewing the change's proposal (its actual job at chain position 2), resolving the standing contradiction with its old "review the current implementation" wording. `HarnessStage`/`STAGES` gain `"verify"` between `"apply"` and `"archive"`; `HarnessChainRunner`'s `CHAIN_STAGES` and `determineStartStage()` are updated to match — a change whose tasks are all checked but isn't yet archived now resumes at `verify`, not `archive` directly. `stepAgents.verify` resolves through the same global/per-change merge as every other stage.
  
  `security.ts`'s `AgentPromptContextOptions` gains an optional `verifiedDelta` field; when present, `prepareAgentContext()` adds a labelled section carrying the verified run's changed files, truncated with a visible count if oversized, and never sourced from `GitWrapper.diff()` (which would leak a concurrent session's unrelated uncommitted work). `HarnessChainRunner` sources this from a checkpoint captured around the `apply` stage, best-effort — a chain with no delta available (or one that never captures a checkpoint) produces the exact same prompt as before this change.
  
  `packages/extension`/`packages/webui`: the hand-maintained stage lists in the per-change harness config wizard (`commands.ts`) and the Harness Settings view (`HarnessSettingsView.tsx`) now include `verify` in chain order.

## 0.35.0

### Minor Changes

- 6ed2d1a: Added accounting plumbing for a run's resource usage and observed agent version, and an optional cost/token budget for Agentic Harness chains.
  
  `AuditEntry` (security.ts) gains optional `usage`, `agentVersion`, and `changeDir` fields — all optional, so audit lines written before this change stay valid. `agent-detection.ts` now captures a best-effort agent version from the `--version` probe it already runs (no second spawn) via a new `detectAvailableAgentsDetailed()` export; the existing `detectAvailableAgents()` boolean-map contract is unchanged. New `agent-usage.ts` defines the adapter-agnostic `AgentUsage` shape; new `usage-report.ts` aggregates recorded usage by agent, by model, and by change, distinguishing unmeasured runs from zero cost. New `verified-agent-versions.ts` holds the single `claude` CLI version this project's structured-output parsing was verified against.
  
  `HarnessConfig` gains an optional `budget` (`maxCostUsd`/`maxTokens`); `HarnessChainRunner` checks it before starting each stage of a chain and refuses to continue once recorded usage reaches it, naming the budget as the reason. A run already in progress is never interrupted. `WorkbenchProcess` gains an optional `usage` field so a run's recorded cost can be shown in the Processes view (extension tree, webui table) when present — never as `$0.00` when absent.
  
  No adapter is changed by this commit: nothing yet produces `AuditEntry.usage`, so the budget stays inert until a future change (`acp-agent-adapters`) adds a producer.

## 0.34.1

### Patch Changes

- d15f4cb: An Agentic Harness run's prompt now includes the project's own instructions for the artifact being worked on (`implement` -> `tasks`, via `openspec instructions <artifact> --change <id>`), in a section labelled as rules to follow, ahead of the change's own content. Previously `prepareAgentContext()` built a run's prompt from only `proposal.md`/`design.md`/`tasks.md`/`specs/*/spec.md`, so rules such as "mark each task as soon as its own verification passes" never reached an agent run through this path, even though they were reachable via the CLI. When the rules lookup fails or returns nothing, the run proceeds exactly as before. `copilot-cli`'s fallback prompt (used once the rules addition pushes prompts past its argv length threshold) now also tells the agent to run `openspec instructions tasks --change <id>` itself.

## 0.34.0

### Minor Changes

- db0e717: Agentic Harness `stepAgents` entries may now declare `dispatch: "vscode-chat"` (alongside the existing `"cli"`, the default) to hand a stage's prompt to VS Code's own chat instead of spawning a CLI subprocess — the same `workbench.action.chat.open` dispatch `openspec-ui.startImplementation` already used, now reachable through the harness. Valid only under `autonomyLevel: assisted`, and only in the VS Code delivery target; resolving it in the standalone server is a configuration error rather than a silent fallback to a CLI. Such a stage emits `started` followed by a new non-terminal `handedOff` event, never `completed` — nothing observes the chat session's work. Existing configurations are unaffected: absent `dispatch`, every stage behaves exactly as before.
- 6b13d58: Agentic Harness `stepAgents` entries may now name a model alongside the agent (`{ agent, model }`, in addition to the existing bare agent id string), passed as `--model <value>` to `claude-cli`/`copilot-cli`. Lets a change configure a cheap model for `apply` and an expensive one for `propose`/`review`/`archive` on the same CLI. A model is validated against a closed character set and against the target agent's registry entry at config-read time, before any run starts.

### Patch Changes

- 6b13d58: Agent presence detection now allows a CLI 10 s to answer a `--version` probe instead of 3 s. On a loaded Windows machine `copilot --version` measured 4.96-6.51 s and `claude --version` 1.61-2.72 s, so an installed, working CLI was annotated as "not detected". A genuinely missing executable still resolves immediately via `cross-spawn`'s `error` event rather than waiting out the budget, and probes still run in parallel, so the worst case grows once, not per agent.
- d9084ab: An Agentic Harness chain now decides between the `apply` and `archive` stages from the change's own `tasks.md` checkboxes, and refuses to archive while any task is unchecked. Previously `statusChange()` synthesized a `progress` value from artifact presence when the CLI reported none, where an artifact being "done" means only that its file exists; a change with all four artifact files written and every task unchecked therefore reported `remaining: 0`, and a chain skipped `apply` and archived it unimplemented. `progress` is now optional on `OpenSpecStatusResult` and absent when the CLI reports none, rather than fabricated. When task completion cannot be determined at all, a chain starts at `apply` and refuses to archive, so an unknown signal never selects the irreversible stage.

## 0.33.2

### Patch Changes

- 5ce55ae: Fix `claude-cli` runs stalling on an unanswerable Edit/Write/Bash permission prompt in non-interactive mode. `buildInvocation()` now passes `--dangerously-skip-permissions`, matching the existing non-interactive-bypass posture already used by `copilot-cli` (`--allow-all-tools`) and `gemini-cli` (`--yolo`).

## 0.33.1

### Patch Changes

- 3f294f3: Fix `copilot-cli` `plan`/`review`/`implement` runs failing outright
  (`copilot exited with code 1`, no work done) for any change whose combined
  `proposal.md`/`design.md`/`tasks.md`/delta-spec content is large — a
  direct side effect of the `agent-prompt-context` fix, which made prompts
  carry real content instead of being nearly empty. `copilot -p` delivers
  the prompt only as a positional CLI argument (no stdin path), and
  cross-spawn resolves its npm-global `.cmd` shim through `cmd.exe`, whose
  own command-line length budget (~8191 characters) is easy to exceed once
  real file content is embedded. `CopilotCliAdapter` now falls back to a
  short prompt naming the change's directory and instructing the agent to
  read its files itself (it already runs with `--allow-all-tools`) whenever
  the full embedded prompt would be too large, instead of failing.
  
  See `openspec/changes/copilot-prompt-length-limit/` for the full
  diagnosis (reproduced live; the raw stderr bytes decode as CP866 to the
  Russian-language OS text for "the command line is too long").

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
