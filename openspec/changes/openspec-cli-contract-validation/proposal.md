## Why

The core wrapper currently casts parsed JSON directly to TypeScript interfaces.
Valid JSON with a changed schema can therefore reach adapters and fail later as
missing fields, blank UI state, or misleading command results.

## What Changes

- Validate each supported OpenSpec JSON command at the core boundary.
- Add a typed compatibility error with command and expected contract metadata.
- Preserve a bounded output preview for diagnostics without exposing unlimited CLI output.
- Add malformed and forward-compatible fixture tests beside real CLI fixtures.
- Exercise all wrappers against the repository's pinned OpenSpec CLI.

## Impact

- `packages/core`: runtime contract validators and typed diagnostics.
- `packages/server` and `packages/extension`: receive actionable core errors through existing paths.
- CI remains pinned to OpenSpec CLI 1.7.0 as the verified contract baseline.