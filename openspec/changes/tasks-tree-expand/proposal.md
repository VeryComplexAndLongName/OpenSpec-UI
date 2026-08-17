## Why

A specific gap raised in review: the "Changes" and "Archive" tree views
(`openspec/specs/vscode-extension/spec.md`) already expand a change node
to show its artifacts (`proposal.md`/`design.md`/`tasks.md`/delta specs)
via `ArtifactTreeItem`, but not the *individual tasks* inside
`tasks.md` — a user who wants to see or manage progress on one specific
task has to open `tasks.md` and read/edit it manually, with no tree-level
view of task status, no per-task delete, and no quick way to jump from
"I clicked this task in the tree" to "here it is in the open markdown
file." This is the same class of gap `archive-tasks-as-template`/
`template-catalog` already closed for other change artifacts — tree-level
interaction was extended to those, but never to tasks.md's own checklist
items.

## What Changes

- Expand each `ChangeTreeItem` (in both the "Changes" and "Archive" tree
  views) to also list its individual checklist tasks from `tasks.md` as
  child tree items, alongside the existing artifact children.
- Clicking a task tree item opens (or reveals, if already open)
  `tasks.md` with the cursor moved to and the line selected/centered at
  that exact task — in both trees, since this is a non-destructive,
  purely informational action.
- Add "Delete Task" to the task context menu, **active changes only**
  (never on archived tasks — the Archive tree's task children are
  read-only/informational, matching how the Archive tree already has no
  mutating actions beyond "Copy Tasks as Template" and "Unarchive" on the
  change itself). Deleting a task removes that exact checklist line from
  the change's `tasks.md`, with a confirmation prompt.
- Core: new `readTaskChecklist`/`deleteTaskLine` functions
  (`packages/core/src/task-checklist.ts`) — `deleteTaskLine` re-verifies
  the target line still contains the expected task text at delete time
  (re-reading the file fresh, not trusting a potentially-stale line
  number from when the tree was last refreshed) and fails closed with a
  clear error if the file changed underneath, rather than risking
  deleting the wrong line.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension`: the Changes and Archive tree views now expose
  individual tasks as child nodes, with reveal-in-editor (both trees) and
  delete (active changes only).

## Impact

- `packages/core/src/task-checklist.ts` (new), `index.ts` (export).
- `packages/extension/src/tree/changes-tree.ts` (`TaskTreeItem`, shared
  `getChangeChildren` helper reused by both tree providers),
  `src/tree/archive-tree.ts` (calls the shared helper instead of
  duplicating the artifact-only logic it has today).
- `packages/extension/src/commands.ts` (`openspec-ui.revealTask`,
  `openspec-ui.deleteTask`), `package.json` (command registration +
  context-menu entry scoped to active-task items only).
- No REST endpoint / standalone UI — this is a VS Code tree/editor
  interaction, not a data operation standalone's browser shell has an
  equivalent surface for today (no per-task tree view exists there); core
  still owns the actual mutation logic, so standalone parity remains a
  clean, non-breaking follow-up if ever wanted, per ADR-0001's
  single-source-of-truth-in-core invariant.
- No change to the command/event protocol.
