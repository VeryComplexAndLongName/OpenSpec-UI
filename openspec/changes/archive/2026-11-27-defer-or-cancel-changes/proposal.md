## Why

Ideas that are deferred or dropped continue to occupy the active Pipeline.
Finishing a real implementation and putting an idea aside are different
decisions. ADR 0001 keeps completed and archived status derived from OpenSpec
artifacts, so Workbench needs a separate disposition for planning decisions.

## What Changes

- Record Deferred or Cancelled with a reason, and allow restoring the change
  to the active Pipeline.
- Show deferred and cancelled cards in a separate view while preserving their
  tasks, history, branch, and worktree.
- Keep acceptance and specification synchronization separate from disposition.

## Capabilities

### New

- `change-disposition`: show and update deferred or cancelled changes.

### Modified

None.

## Changelog

Affected deliveries: VS Code extension and standalone Workbench, including
the standalone app bundled in the npm CLI.

- Put a change aside with a reason, or record that it was cancelled. Find it
  under deferred and cancelled changes and return it to the active Pipeline.
