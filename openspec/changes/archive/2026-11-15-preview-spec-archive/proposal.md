## Why

[ADR 0035](../../../docs/adr/0035-a-landed-change-is-archived-for-you.md) moves archiving after merge. An operator can see a refused archive then, but needs to see its proposed specification edits and collisions before accepting a change.

## What Changes

- Add Show Archive Preview to a change in VS Code and standalone.
- Show the specification diff from applying the committed delta to the locally known default branch.
- Name changed requirements at the target and overlapping requirements in other local active change branches.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-workbench` previews specification updates from archiving.

## Changelog

### VS Code extension and standalone app

- Select **Show Archive Preview** to see the specification patch a committed change would produce against the locally known default branch. The preview names overlapping requirements in local branches and surfaces an archive refusal before merge.
