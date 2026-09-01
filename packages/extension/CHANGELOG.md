# Changelog

## 0.30.6

### Patch Changes

- dc71cec: Added a `verify` stage to the Agentic Harness chain, running after `apply` and before `archive`, per `docs/adr/0018-event-driven-harness-orchestration.md` gap 1. It reviews the implementation against `tasks.md` and the change's spec delta, and unchecks any task whose stated verification does not actually hold — the existing archive gate (which already refuses to archive a change with unchecked tasks) is what stops the chain, not a new outcome or gate.
  
  `CommandKind` gains an additive `"verify"` member; `commandInstruction("review")` is reworded to describe reviewing the change's proposal (its actual job at chain position 2), resolving the standing contradiction with its old "review the current implementation" wording. `HarnessStage`/`STAGES` gain `"verify"` between `"apply"` and `"archive"`; `HarnessChainRunner`'s `CHAIN_STAGES` and `determineStartStage()` are updated to match — a change whose tasks are all checked but isn't yet archived now resumes at `verify`, not `archive` directly. `stepAgents.verify` resolves through the same global/per-change merge as every other stage.
  
  `security.ts`'s `AgentPromptContextOptions` gains an optional `verifiedDelta` field; when present, `prepareAgentContext()` adds a labelled section carrying the verified run's changed files, truncated with a visible count if oversized, and never sourced from `GitWrapper.diff()` (which would leak a concurrent session's unrelated uncommitted work). `HarnessChainRunner` sources this from a checkpoint captured around the `apply` stage, best-effort — a chain with no delta available (or one that never captures a checkpoint) produces the exact same prompt as before this change.
  
  `packages/extension`/`packages/webui`: the hand-maintained stage lists in the per-change harness config wizard (`commands.ts`) and the Harness Settings view (`HarnessSettingsView.tsx`) now include `verify` in chain order.
- Updated dependencies [dc71cec]
  - @openspec-ui/core@0.36.0
  - @openspec-ui/webui@1.17.5
  - @openspec-ui/server@1.13.5

## 0.30.5

### Patch Changes

- 6ed2d1a: Added accounting plumbing for a run's resource usage and observed agent version, and an optional cost/token budget for Agentic Harness chains.
  
  `AuditEntry` (security.ts) gains optional `usage`, `agentVersion`, and `changeDir` fields — all optional, so audit lines written before this change stay valid. `agent-detection.ts` now captures a best-effort agent version from the `--version` probe it already runs (no second spawn) via a new `detectAvailableAgentsDetailed()` export; the existing `detectAvailableAgents()` boolean-map contract is unchanged. New `agent-usage.ts` defines the adapter-agnostic `AgentUsage` shape; new `usage-report.ts` aggregates recorded usage by agent, by model, and by change, distinguishing unmeasured runs from zero cost. New `verified-agent-versions.ts` holds the single `claude` CLI version this project's structured-output parsing was verified against.
  
  `HarnessConfig` gains an optional `budget` (`maxCostUsd`/`maxTokens`); `HarnessChainRunner` checks it before starting each stage of a chain and refuses to continue once recorded usage reaches it, naming the budget as the reason. A run already in progress is never interrupted. `WorkbenchProcess` gains an optional `usage` field so a run's recorded cost can be shown in the Processes view (extension tree, webui table) when present — never as `$0.00` when absent.
  
  No adapter is changed by this commit: nothing yet produces `AuditEntry.usage`, so the budget stays inert until a future change (`acp-agent-adapters`) adds a producer.
- Updated dependencies [6ed2d1a]
  - @openspec-ui/core@0.35.0
  - @openspec-ui/webui@1.17.4
  - @openspec-ui/server@1.13.4

## 0.30.4

### Patch Changes

- Updated dependencies [d15f4cb]
  - @openspec-ui/core@0.34.1
  - @openspec-ui/server@1.13.3
  - @openspec-ui/webui@1.17.3

## 0.30.3

### Patch Changes

- db0e717: Tree-scoped commands now act on the row highlighted in the tree when they are invoked without one. The Command Palette always invokes a command with no arguments — only a tree's own right-click menu passes the clicked item — so running "OpenSpec UI: Archive Change" from the palette with a change highlighted reported `select a change in the tree first`, telling the user to do what they had already done. The Changes, Archive and Templates views are now registered with `createTreeView`, whose handle exposes `selection`, and each command falls back to that selection when exactly one row of the kind it expects is highlighted in the view that owns it. Several rows, a row of another kind, or nothing selected all still refuse, because picking one of them would be a choice the user never made; the state checks and the modal confirmations each command already performs are unchanged. The warning now names the right-click menu as the alternative.
- Updated dependencies [6b13d58]
- Updated dependencies [6b13d58]
- Updated dependencies [d9084ab]
- Updated dependencies [db0e717]
- Updated dependencies [6b13d58]
  - @openspec-ui/core@0.34.0
  - @openspec-ui/webui@1.17.2
  - @openspec-ui/server@1.13.2

## 0.30.2

### Patch Changes

- 09ab8bf: Fix 15 tree-scoped commands (`archiveChange`, `unarchiveChange`, `deleteChange`, `deleteTask`, `revealTask`, `runWithHarness`, and 9 others) silently doing nothing when invoked via the Command Palette with no tree item selected. They now show an explicit warning naming the kind of item required, matching the existing `reviewDiff` behavior.

## 0.30.1

### Patch Changes

- Updated dependencies [5ce55ae]
  - @openspec-ui/core@0.33.2
  - @openspec-ui/server@1.13.1
  - @openspec-ui/webui@1.17.1

## 0.30.0

### Minor Changes

- 211c001: Add "OpenSpec UI: Create Change Template" — creates an OpenSpec change and,
  in the same flow, optionally walks through configuring that change's
  per-change Agentic Harness override (which agent handles each stage, the
  autonomy level, the review gate) instead of requiring a separate
  "configure harness" step afterward. Declining customization, or leaving
  every question at its default, writes no per-change `harness.json` —
  identical to a change created without ever running this command.
  
  See `openspec/changes/agentic-harness-change-template/` for the full
  design.

### Patch Changes

- Updated dependencies [b21d2f4]
  - @openspec-ui/core@0.33.0

## 0.29.0

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

### Patch Changes

- Updated dependencies [be47425]
- Updated dependencies [be47425]
  - @openspec-ui/core@0.32.0
  - @openspec-ui/server@1.13.0
  - @openspec-ui/webui@1.17.0

## 0.28.0

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

### Patch Changes

- Updated dependencies [3a93782]
- Updated dependencies [cc7fc8a]
- Updated dependencies [da70d78]
- Updated dependencies [47b2fc4]
- Updated dependencies [fcd2f15]
  - @openspec-ui/core@0.31.0
  - @openspec-ui/server@1.12.0
  - @openspec-ui/webui@1.16.0

## 0.27.0

### Minor Changes

- Add a cross-host workspace lease (docs/adr/0010-cross-host-workspace-lease.md) so at most one host process — a VS Code extension or a standalone server, pointed at the same workspace — can run a mutating operation at a time. A blocked host gets an immediate, actionable error naming the other host instead of racing it or queuing forever. The standalone server's own `implement` execution is now routed through the same mutation lock and lease (it previously bypassed the scheduler entirely), closing a pre-existing same-host gap alongside the cross-host one.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.30.0
  - @openspec-ui/server@1.11.0

## 0.26.0

### Minor Changes

- Add "OpenSpec UI: Generate Sprint Report (PDF)" Command Palette command: pick a date range and one or more changes, then save a generated PDF sprint report and optionally open it.

## 0.25.0

### Minor Changes

- Add stale-pending-task detection: a pending task untouched (per git
  blame) longer than a configurable threshold (default 14 days) is now
  flagged in the Change Timeline view. Configurable via a number input in
  the standalone Timeline tab and the new `openspec-ui.staleTaskThresholdDays`
  VS Code setting.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.28.0
  - @openspec-ui/webui@1.14.0

## 0.24.1

### Patch Changes

- Fix the change timeline webview showing "No timeline data" for every
  user: its CSP blocked the inline script that embeds the fetched data
  (the bundle's own external script tag still loaded, masking the
  failure instead of erroring). Fixed via a per-panel CSP nonce.

## 0.24.0

### Minor Changes

- Add a "compare changes" timeline: a new global command
  (`openspec-ui.showAllChangesTimeline`) and a standalone Timeline-tab
  mode that show several changes as parallel lanes on a shared,
  log-scaled time axis (verified against real archived-change data
  before choosing the log-scale direction). Also adds the CSS the
  single-change timeline view needed but was missing, and fixes archived
  dates plotting before same-day created/task timestamps.

### Patch Changes

- Updated dependencies
  - @openspec-ui/webui@1.13.0

## 0.23.0

### Minor Changes

- Add a "Show Change Timeline" context-menu command (active and archived
  changes) and a standalone "Timeline" tab: proposal/design/spec content
  followed by tasks positioned by best-effort git-derived completion
  date, with pending/undated tasks shown distinctly. The extension
  computes the timeline directly (no HTTP, no message bridge) and opens
  it in a new webview tab per change.

### Patch Changes

- Updated dependencies
  - @openspec-ui/webui@1.12.0

## 0.22.0

### Minor Changes

- Add an archive-time Changesets reminder to the VS Code extension. When a
  workspace has adopted Changesets (`.changeset/config.json` exists) and no
  changeset is currently pending, archiving a change now offers to run
  `npx changeset` in an integrated terminal. Silent for workspaces that
  have not adopted Changesets, and never affects the archive operation's
  own result.

### Patch Changes

- Updated dependencies
  - @openspec-ui/core@0.26.0

## 0.21.0

### Minor Changes

- Notify when a `plan`/`implement`/`review` run finishes while you're not
  watching the Processes view or the AI panel. The VS Code extension shows a
  native notification (with a "View" action that opens the Process
  Dashboard); the standalone app shows a browser notification, once
  permission is granted. `status`/`list`/`show`/`validate` (near-instant) and
  `cancelled`/`interrupted`/`rolled-back` runs are not notified.

### Patch Changes

- Updated dependencies
  - @openspec-ui/webui@1.10.0

## 0.20.2

- Fixed: every screenshot in the "Details" tab (Extensions view and
  Marketplace) was broken. `vsce package` rewrites relative README image
  paths to `https://github.com/<repo>/raw/HEAD/<original-path>`, but does
  not account for this package's `repository.directory`
  (`packages/extension`) and does not collapse `..` segments — the
  previous `../../docs/images/extension/*.png` paths became a literal,
  unresolvable `HEAD/../../docs/images/extension/*.png` URL. Screenshot
  links now use absolute `raw.githubusercontent.com` URLs, which `vsce`
  leaves untouched and which resolve correctly.

## 0.20.1

- Docs only: the Marketplace description and the root README's Delivery
  Capability Matrix now mention the built-in template catalog's actual
  size (16 templates across 9 categories) — previously the catalog's
  growth across four merged changes today was reflected only in
  `CHANGELOG.md` entries and archived OpenSpec changes, not in either
  user-facing README.

## 0.20.0

- Added a built-in template in a new `configuration` category: "Validate
  environment configuration at startup instead of failing on first use" —
  a schema-validated config module that crashes immediately with a clear
  error on a missing or invalid environment variable, instead of failing
  later at whatever code path first reads it.

## 0.19.0

- Added a built-in template: "Migrate a Create React App project to Vite"
  (`framework-migration`) — closes a gap where that category only had a
  Python backend example (Flask to FastAPI), despite JavaScript being
  named as its own target language for the catalog.

## 0.18.0

- Added two built-in templates in a new `observability` category:
  "Add structured JSON request logging to a Node.js/TypeScript HTTP API"
  and "Add a per-request correlation ID to logs and responses" (language-
  agnostic). The two are independent and complementary — neither requires
  the other.

## 0.17.0

- Added three ASP.NET Core built-in templates: "Add Entity Framework Core
  and migrations to an ASP.NET Core project" (`data-layer`), "Add an
  xUnit testing baseline to an ASP.NET Core project" (`testing`), and
  "Add JWT bearer authentication to an ASP.NET Core API" (`auth`) —
  closing a gap where ASP.NET Core, one of this product's four
  originally-targeted languages, had zero built-in templates.

## 0.16.3

- The per-command instruction text sent to CLI agents (`plan`/`implement`/
  `review`/`status`/`cancel`) is now in English instead of Russian, for
  consistency with the other command kinds and this repository's
  English-only policy. No change to which commands are available or how
  they behave beyond the language of that instruction text.

## 0.16.2

- Fixed: mutating operations such as archive no longer fail checkpoint limits
  because of ignored project output. Checkpoint capture now honors root and
  nested `.gitignore` rules, `.git/info/exclude`, and global Git excludes while
  retaining tracked and negated files. Mandatory `.env`, virtual-environment,
  and generated-cache exclusions remain active, and historical journals are
  sanitized on workspace activation without deleting project files.

## 0.16.0

- Templates tree and the standalone Templates tab now group templates
  by category instead of a flat per-origin list. VS Code: "Built-in" and
  "Project" each gain an alphabetically-sorted category subgroup level —
  a template is never a direct child of the origin group anymore.
  Standalone: table rows are sorted by category with a subheader row per
  category boundary. Presentation-only — no change to the underlying
  catalog data or to customize/insert/delete actions.

## 0.15.2

- Docs only: Marketplace description now leads with the built-in
  Claude/Copilot/Codex/Gemini agents instead of generic "native OpenSpec
  workflow" wording — no code changes.

## 0.15.1

- Docs only: added a Screenshots section to the root README (sidebar
  overview, Changes/Tasks nesting, Archive context menu, Repository
  Setup, Specs, Templates) — no code changes.

## 0.15.0

- Fixed: task checklist items in the Changes and Archive trees rendered
  flush with the "Tasks" artifact instead of nested under it — reported
  live twice, since the previous fix (`0.13.1`) addressed a real but
  separate bug (unstable tree-item identity) that turned out not to be
  the actual cause. `tasks.md`'s artifact entry is now its own
  collapsible node; expanding it — not the Change directly — is what
  reveals the individual checklist items. Clicking "Tasks" still opens
  the file, unchanged.

## 0.14.0

- Added "Rollback Change" on a Change item (in either the Changes or
  Archive tree): rolls back every process ever run against that Change,
  restoring every touched file to its state before the earliest of those
  runs — works identically for active and archived changes. Same fail-
  closed behavior as single-process rollback: any file changed outside
  what the system knows about refuses the entire restore.
- Added `openspec-ui.checkpointRetentionDays` setting (default `0` =
  keep forever, unchanged from prior versions). A positive value prunes
  process/checkpoint history older than that many days once, on the next
  window reload — pruning permanently removes Rollback availability for
  the pruned processes, disclosed in the setting description and in this
  README.

## 0.13.1

- Fixed: task items in the Changes and Archive trees could render flush
  with their parent Change instead of nested under it, and lose
  collapse/expand behavior — none of this codebase's `TreeItem`
  subclasses set an explicit `.id`, so VS Code fell back to a
  label-derived identity that can desync once items are recreated on
  every refresh (which they always are here). Also fixed the identical,
  not-yet-reported defect in the Templates tree's built-in/project
  groups.

## 0.13.0

- Added a "Repository Setup" node to the Changes tree, right after
  "OpenSpec Configuration": expanding it lists "Generate Agent
  Instructions", "Configure Dependabot", and "Generate Path-Scoped
  Copilot Instructions" as clickable items. These commands already
  existed (0.12.0) but were Command Palette-only with no tree presence —
  this makes them discoverable without knowing the exact command name to
  search for.

## 0.12.1

- "Delete Task" is no longer offered for a task marked done, even in an
  active (non-archived) change — matching the guard already in place for
  archived changes. A completed checklist line records that the work
  happened; the fix for a wrongly-checked task is unchecking it, not
  deleting the record.

## 0.12.0

- Added three Command Palette commands to bootstrap repository files
  from a built-in, project-type-keyed registry (seed types: Node.js/
  TypeScript, Python): "Generate Agent Instructions" (writes identical
  content into `CLAUDE.md` and `AGENTS.md`), "Configure Dependabot"
  (writes/accumulates `.github/dependabot.yml`), and "Generate
  Path-Scoped Copilot Instructions" (writes
  `.github/instructions/<subtype>.instructions.md` with `applyTo`
  frontmatter). All three leave any pre-existing, not-managed-by-us file
  untouched and report it instead of overwriting.

## 0.11.0

- The Changes and Archive trees now expand each change to also show its
  individual `tasks.md` checklist items, not just its artifacts.
  Selecting a task opens (or reveals, if already open) `tasks.md` at
  that exact line, in both trees. "Delete Task" removes a single
  checklist line from an active change's `tasks.md`, with confirmation —
  archived tasks offer no delete action.

## 0.10.1

- "Customize Template" now opens the created `template.json` after
  success, instead of only showing a notification and silently
  refreshing the tree — found via live testing: the tree refresh alone
  gave no visible feedback unless "Project" was already expanded.

## 0.10.0

- Added "Delete Project Template" to the Templates view, scoped to
  project-level templates only (with confirmation) — built-in templates
  are never deletable through the UI.
- Added three built-in templates: Flask→FastAPI migration, a
  language-agnostic flat-to-hexagonal-architecture migration, and a
  Node.js/TypeScript Vitest + ESLint testing baseline.

## 0.9.0

- The AI panel's agent picker now shows a best-effort detected/not-detected
  annotation per agent, refreshed automatically every time the panel is
  opened in the default message-bridge dashboard. This never hides or
  disables an option — it only annotates presence, not authentication.

## 0.8.0

- Added a Templates view (Built-in and Project groups) to the OpenSpec UI
  activity bar.
- Added "Customize Template" to fork a built-in template into
  `openspec/templates/<id>/` in the workspace, with a backlink to the
  built-in version it was forked from.
- Added "Insert Template Into…" to render a template's variables and
  insert the result into a picked non-archived change's proposal, design,
  and tasks files.
- Added JSON Schema validation for `openspec/templates/*/template.json`.

## 0.7.0

- Added an agent picker to the Process Dashboard's AI panel: `plan`,
  `implement`, and `review` can now run through a selectable CLI agent
  (Claude CLI, GitHub Copilot CLI, Codex CLI, Gemini CLI, or a local
  OpenAI-compatible LLM), in both the default message-bridge dashboard
  and the optional local-server mode. This is independent of, and does
  not change, the existing `@openspec` Chat Participant and "Implement
  with VS Code Agent" native Chat/Agent path.

## 0.6.0

- Added "Copy Tasks as Template Into…" to the Archive tree: copies an
  archived change's tasks (checkboxes reset to unchecked) into a picked
  non-archived change's tasks file.

## 0.5.0

- The optional local-server dashboard (`openspec-ui.transport.localServer.enabled`)
  now shows only the "Run a Command" panel — Diff Preview, Processes and
  Recovery, OpenSpec view summary, and Change Editor are already covered
  by native VS Code UI (diff editor, tree views, file editing) and are no
  longer duplicated inside the embedded Webview.

## 0.4.3

- Added actionable compatibility diagnostics when OpenSpec CLI JSON output no
  longer matches fields consumed by the workbench.

## 0.4.2

- Added actionable, fail-closed diagnostics when persisted run journals or
  checkpoints require a newer OpenSpec UI version.

## 0.4.1

- Authenticated optional local-server sessions with an ephemeral token passed
  to the embedded standalone UI through a URL fragment.

## 0.4.0

- Initialized Process Dashboard workspace and change-directory fields from the
  active VS Code workspace instead of stale browser storage.
- Updated an already-open dashboard when it is revealed with new change
  context.
- Added extension-only styling based on VS Code semantic theme variables for
  light, dark, high-contrast, and custom themes.

## 0.3.0

- Added a workspace-local, versioned run journal with atomic updates.
- Added recovery of process history and interrupted implementation checkpoints
  after extension reload.
- Added persisted rollback for deterministic lifecycle mutations, including
  failed operations.
- Serialized all workspace mutations to prevent cross-change checkpoint
  contamination while preserving concurrent read-only work.
- Added explicit checkpoint coverage for files omitted by size limits.
- Renamed the Marketplace display name to OpenSpec Workbench.

## 0.2.0

- Added hierarchical navigation for configuration, change artifacts, delta
  specs, archive, and canonical specs with actionable empty states.
- Added create, validate, archive, unarchive, and guarded delete workflows.
- Added a Processes view backed by per-change mutation scheduling.
- Added the native `@openspec` Chat participant for plan, implement, review,
  status, and validation workflows.
- Added checkpointed VS Code Agent implementation sessions with conflict-safe
  rollback.
- Replaced stale agent-CLI documentation and command names.

## 0.1.0

- Added the initial local extension with Changes, Archive, and Specs views.
- Added direct OpenSpec status, list, show, and validation commands.
- Added native markdown, Git, and diff integration.
- Added the optional local-server transport mode.
