## Why

The PR Review action follows [ADR 0044](../../../docs/adr/0044-a-change-is-acted-on-from-its-card.md), but its verification section reports only local records. On PR #964, the operator had to leave Workbench to discover that GitHub had not produced the expected CI result for the published head.

## What Changes

- Add **Refresh GitHub checks** to PR Review in VS Code and standalone. Show the open GitHub PR, published head, check states and available GitHub run links.
- List required checks read from the PR base branch. Identify results absent from the published head and distinguish unavailable or partial reads from an empty result.
- Label the published PR head independently of local verification evidence and include the refreshed view in **Copy PR summary**.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pr-review` adds an on-demand GitHub checks report tied to the published PR revision.

## Changelog

### VS Code extension and standalone app

- Select **Refresh GitHub checks** in PR Review to see check statuses and run links for the published PR commit. The report also lists expected checks when GitHub makes the target branch rules available.
