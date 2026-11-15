## Why

Archive Preview detects changes to the same OpenSpec requirement across branches. Finding them before an Apply run lets an operator coordinate the planned edits while the implementation can still change.

## What Changes

- Add **Show Spec Overlaps** as a read-only action on active Pipeline cards in both hosts.
- Reuse the requirement comparison used by Archive Preview. Show the requirements changed on the locally known default branch and the names of other local changes that touch the same requirements.
- Show the committed requirement text at the common ancestor, default branch and proposed delta for the first findings. Explain when the available history or inspected branches limit the result.

## Capabilities

### Modified Capabilities

- `openspec-workbench` reports requirement overlaps before Apply from the Pipeline card.

## Changelog

### VS Code extension and standalone app

- Select **Show Spec Overlaps** on a Pipeline card before running Apply. See which requirements changed on your locally known default branch or are also named by another local change, with the three versions available for comparison.
