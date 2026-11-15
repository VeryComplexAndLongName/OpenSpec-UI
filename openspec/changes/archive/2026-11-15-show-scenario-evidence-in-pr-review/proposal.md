## Why

[ADR 0044](../../../docs/adr/0044-a-change-is-acted-on-from-its-card.md) gives reviewers a single action for a change. An aggregate CI result still leaves the reviewer to find which OpenSpec scenarios a named check covers.

## What Changes

- List scenarios added or modified by the reviewed commit in PR Review.
- Support an optional scenario-checks.json beside the change proposal. It explicitly associates a scenario with one or more named GitHub checks.
- After refresh, show the observed result of a linked check only when the published head equals the reviewed commit. Distinguish an unlinked scenario, an absent result and ambiguous names.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pr-review` associates OpenSpec scenarios with check evidence.

## Changelog

### VS Code extension and standalone app

- PR Review now lists the change's added and modified scenarios. A committed scenario-checks.json can associate each scenario with named GitHub checks and show their results for the reviewed commit.
