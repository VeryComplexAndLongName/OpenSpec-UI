# Changelog

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
