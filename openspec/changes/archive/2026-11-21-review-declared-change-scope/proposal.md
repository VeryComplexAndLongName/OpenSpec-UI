# Proposal

## Why

A committed diff can contain unrelated agent edits even when all planned tasks are checked. Following ADR 0001, Core should compare actual paths with an explicit declaration so both hosts warn about scope drift consistently, without treating repository prose as executable instructions.

## What Changes

- Add an optional committed `change-scope.json` beside the proposal, listing exact repository-relative files and directory prefixes.
- Show outside-scope paths in PR Review and Copy PR summary for the displayed committed comparison, including both sides of a rename.
- Explain missing, invalid, unreadable or changed declarations rather than claiming the change stayed within an agreed plan.
- Keep this an advisory read-only check; declarations are reviewed data, not a sandbox or permission grant.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `pr-review`: compare committed changed paths against explicitly declared scope and preserve uncertainty in the copied summary.

## Impact

Core PR Review, its existing server/extension callers and a new how-to page. No new dependency, protocol command, agent event or write action is required. Uncommitted edits remain excluded by the existing comparison contract.

## Changelog

Affected deliveries: VS Code extension and standalone server; Core carries the shared implementation.

- PR Review flags committed files outside the paths listed in a change's `change-scope.json`, including paths removed by renames. The copied summary retains missing/invalid declarations and warns when the declaration itself changed.
