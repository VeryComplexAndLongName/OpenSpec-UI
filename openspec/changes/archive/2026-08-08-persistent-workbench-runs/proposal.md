# Persistent Workbench Runs

## Why

ADR 0004 addresses two concrete reliability risks left open by ADR 0003:
extension reload currently discards process/checkpoint state, and per-change
mutation locks do not isolate shared workspace files. Users need durable,
honest rollback protection rather than memory-only recovery claims.

## What Changes

- Add a versioned, atomic run and checkpoint journal in shared core.
- Restore process history and interrupted implementation checkpoints when the
  extension activates.
- Serialize workspace mutations until filesystem isolation is available.
- Report checkpoint exclusions and skipped files as explicit coverage data.
- Document package-level version ownership and the current delivery parity
  boundary.
- Bump core and extension minor versions for the new compatible capability.

## Capabilities

### New Capabilities

- `persistent-workbench-runs`: durable process history, interrupted-run
  recovery, and persisted rollback state.

### Modified Capabilities

- `openspec-workbench`: workspace-wide mutation isolation and visible
  checkpoint coverage.

## Impact

- `packages/core`: scheduler isolation, checkpoint serialization/coverage, and
  persistent journal.
- `packages/extension`: startup recovery, journal synchronization, and recovered
  process controls.
- `docs/adr/0004-persistent-workbench-runs.md`: persistence, parity, and
  versioning decision.
- Package versions: `@openspec-ui/core` 0.7.0 and `openspec-ui-vscode` 0.3.0.
