## Why

ADR 0003 identifies the gap between the current read-oriented extension and a
complete OpenSpec workflow. Users can inspect changes, but they cannot navigate
all artifacts, manage the lifecycle, visualize concurrent work, or safely use
VS Code-hosted AI to implement and review a change.

## What Changes

- Replace flat extension trees with a navigable OpenSpec workspace hierarchy.
- Add create, validate, archive, unarchive, refresh, and safe delete actions.
- Expose proposal, design, tasks, delta specs, canonical specs, and config in
  native VS Code editors.
- Add a process dashboard with per-change concurrency, progress, cancellation,
  history, logs, and run-scoped rollback.
- Add a native VS Code Chat participant for explicit plan, implement, and review
  workflows without restoring external agent CLIs as the default.
- Add actionable empty states and diagnostics for missing CLI, initialization,
  archive, and canonical specs.
- Bring release documentation and Marketplace metadata in line with delivered
  behavior.

## Capabilities

### New Capabilities

- `openspec-workbench`: integrated navigation, lifecycle management, process
  visualization, native Chat workflows, and checkpoint rollback.

### Modified Capabilities

- `vscode-extension`: expand the extension from inspection commands to the
  complete native Workbench surface.
- `execution-core`: add lifecycle, process scheduling, and checkpoint behavior
  shared by delivery targets.

## Impact

- `packages/core`: lifecycle wrappers, scheduler, process model, checkpoints.
- `packages/extension`: hierarchical trees, commands, Chat participant, native
  editors, process bridge, Marketplace assets.
- Architecture reference: `docs/adr/0003-native-vscode-openspec-workbench.md`.
