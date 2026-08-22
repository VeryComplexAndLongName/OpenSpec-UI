## Why

Workbench checkpoints scan the entire workspace before mutating operations.
Python virtual environments and generated caches can exceed checkpoint limits,
while `.env` contents can persist secrets that must never be stored in run
history.

## What Changes

- Exclude `.env`, generated cache directories, cache files, and local virtual
  environments from new workbench checkpoints.
- Remove those paths from checkpoints restored from existing run journals and
  persist the sanitized journal without deleting workspace files.
- Cover new capture and migration behavior with core tests.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `persistent-workbench-runs`: Checkpoint capture and recovery omit sensitive
  environment files and generated local state.

## Impact

- `packages/core/src/checkpoint.ts`
- `packages/core/src/checkpoint.test.ts`
- Core and extension patch versions
