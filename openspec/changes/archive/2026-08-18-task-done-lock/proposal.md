## Why

`tasks-tree-expand` added a "Delete Task" action on active-change task
items, gated only on archived state (`openspec-ui.activeTask` vs
`openspec-ui.archivedTask`). Raised in review: a task marked done still
offers Delete today, even though deleting a completed checklist line
throws away a record of finished work with no equivalent safeguard to
the one archived changes already get. There's no legitimate reason to
delete a done task's line — if it's wrong, the fix is unchecking it, not
removing the record that it happened.

## What Changes

- A task item whose checklist line is done (`- [x]`) no longer offers
  "Delete Task" in its context menu, in **active** changes — matching
  the existing behavior for archived changes, which already withhold it
  regardless of done-state.
- The command itself refuses to delete a done task even if invoked
  another way (not just menu-gated), the same fail-closed pattern
  already used for the archived-item guard.
- Undone tasks in active changes are unaffected — still deletable exactly
  as before.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension`: "Delete Task" is now withheld for done tasks in
  active changes, not just archived ones.

## Impact

- `packages/extension/src/tree/changes-tree.ts` (`TaskTreeItem`: new
  `openspec-ui.activeTaskDone` contextValue, distinct from
  `openspec-ui.activeTask`).
- `packages/extension/src/commands.ts` (`openspec-ui.deleteTask`: guard
  extended to `item.done`).
- `packages/extension/package.json` (no change needed — the existing
  `viewItem == openspec-ui.activeTask` menu `when`-clause already
  excludes the new `openspec-ui.activeTaskDone` value).
- No change to the command/event protocol, no core or standalone impact.
