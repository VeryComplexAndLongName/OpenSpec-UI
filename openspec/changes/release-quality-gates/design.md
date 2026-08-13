## Context

All packages expose typecheck, lint, and test scripts. Server and extension
also expose builds, and the extension has a real Extension Host integration
suite. None are currently enforced by the remote repository.

## Decisions

- Use the exact Node and npm versions pinned by Volta.
- Run deterministic installs through `npm ci`.
- Separate fast workspace quality checks from the graphical extension
  integration job.
- Package the VSIX only after validation and upload it as a workflow artifact.
- Run dependency review on pull requests and Dependabot weekly.
- Keep dependency review non-blocking until the repository Dependency Graph is
  enabled; the action remains visible and becomes enforceable without a
  workflow redesign once that repository setting is available.

## Verification

- Validate workflow YAML structure locally.
- Run the same root verification, build, integration, and package commands
  before merging this change.
