# Change: Add Standalone Run Recovery

## Why

Core persists workbench runs and checkpoints, and the VS Code delivery exposes
recovery and rollback. Standalone currently has no adapter or UI for that
shared behavior, leaving interrupted work invisible outside VS Code.

## What Changes

- Add a core recovery service over run journals and serialized checkpoints.
- Expose authenticated standalone endpoints for process history, details,
  conflict-safe rollback, and cleanup.
- Add a standalone Processes section with recovery and coverage information.
- Verify recovery across a server restart.

## Impact

- Affected specs: `persistent-workbench-runs`, `standalone-app`
- Affected packages: `core`, `server`, `webui`
- Architecture: implements the standalone follow-up in ADR 0004
