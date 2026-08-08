# Changelog

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
