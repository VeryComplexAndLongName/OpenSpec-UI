## Why

[ADR 0044](../../../docs/adr/0044-a-change-is-acted-on-from-its-card.md) makes PR Review part of a real change's workflow. Someone evaluating Workbench still needs a committed OpenSpec project before they can see and copy a realistic review.

## What Changes

- Add **Open Example** to the standalone workspace and the VS Code command palette.
- Show a fictional checkout change with a short proposal, tasks, committed diff and sample verification. Let the user copy its PR summary.
- Keep the example independent of repository, GitHub and agent configuration.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pr-review` includes a first-run example.

## Changelog

### VS Code extension and standalone app

- Select **Open Example** to explore a sample PR review, including a proposal, tasks, committed diff and verification. Copy its sample summary without setting up a repository or agent.
