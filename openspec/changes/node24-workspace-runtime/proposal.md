# Proposal

## Why

The repository pins Node 22.11.0 in Volta and all CI workflows, but that
version is below the current dependency floor in the lockfile (`undici` requires
Node 22.19.0) and below the documented DeepSeek CLI floor (Node 22.18.0 or
24.2.0). The exact 22.11.0 pin has no recorded architectural requirement and
prevents the repository's own DeepSeek adapter from using the locally available
Node 24.21.0.

## What Changes

- Set the repository's exact Node pin to 24.21.0 and its supported Node range
  to `>=24.2 <25`.
- Use the same Node 24.21.0 in GitHub quality/publish workflows and the Gitea
  quality workflow.
- Keep npm pinned to 10.9.0; this version has been verified with Node 24.21.0.
- Update the root lockfile engine metadata and clarify the historical Node
  constraint in the Dependabot comment.

## Capabilities

### Modified Capabilities

- `quality-gates`: the declared developer runtime and every Node-based CI
  workflow use the same supported Node release.

## Impact

Root package metadata, its lockfile metadata, three CI workflow files, and one
Dependabot explanation. No package source or package version changes. The
existing full CI gate, including the Windows VS Code integration suite, must
run on Node 24.21.0 before this change is considered delivered.