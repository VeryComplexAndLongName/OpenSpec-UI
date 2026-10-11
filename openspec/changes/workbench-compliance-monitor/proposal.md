# Proposal

## Why

Workbench initializes OpenSpec repositories but does not check that its own
runtime files are ignored, and its repository rules are spread across
instructions, specs and operational docs. Users need one explainable catalogue
of checks, configurable responses, and a way to notice drift without turning
compliance into a continuously busy process.

An initialized Python repository has accumulated untracked `.openspec-ui/`
run journals, audit/run logs, leases and temporary lease files in its main
checkout because `.gitignore` does not ignore Workbench runtime state. Its
audit entries identify a change worktree as `cwd`/`changeDir`, so the finding
must distinguish legitimate shared host state from per-run files and must not
move evidence blindly. The UI also exposes the same tracked change from stale
worktree snapshots, and one active change id exists beside its archived copy.

## What Changes

- Add a core-owned catalogue of stable, evidence-linked compliance rules with
  check cost and supported repair metadata.
- On explicit repository initialization, verify that Workbench runtime state
  is ignored by Git and add only the missing managed ignore rule, preserving
  the rest of `.gitignore`.
- Check Workbench runtime files in the main checkout and worktrees; identify
  untracked/visible state and explain the expected root for each state kind
  without moving or deleting it.
- Group equal change ids across worktrees as one logical change; report an id
  present in both active and archive trees, an archived change left in a stale
  worktree, or a shadow copy in main beside its owning worktree. Reconcile the
  Pipeline card count with the Changes list and flag active changes missing
  from the OpenSpec README index with a suggested link, not an automatic edit.
- Add per-rule `autorepair`, `advice` and `none` response settings and a global
  periodic-monitor switch.
- Add a resumable host-owned monitor that runs one bounded batch only after the
  host reports idle and no mutating Workbench run is active.
- Measure each check's elapsed time, schedule by due date and conservative
  cost, and spread expensive checks across later idle windows.
- Present findings and proposed/automatic repairs through the existing
  workbench surfaces; do not start a separate OS daemon.

## Capabilities

### New Capabilities

- `repository-compliance`: a versioned catalogue, per-rule reaction settings,
  initialization checks, workload-aware periodic execution and findings.

### Modified Capabilities

- `openspec-workbench`: repository initialization ensures its local runtime
  state is ignored without overwriting user-authored ignore rules.
- `vscode-extension`: exposes compliance settings and findings, and supplies
  host-idle state to the shared core scheduler.
- `standalone-app`: exposes the same compliance settings and findings, and
  supplies browser-idle state to the shared core scheduler.

## Impact

`packages/core` owns the rule catalogue, evaluation, scheduling and safe
repair logic. `packages/extension` and `packages/server` remain thin adapters;
`packages/webui` presents shared controls and findings. ADR-0049 records the
host-owned scheduling and data-placement decision.