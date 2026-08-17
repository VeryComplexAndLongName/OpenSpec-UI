## Context

`ChangeTreeItem` (`changes-tree.ts`) already carries a real, discovery-
sourced `changeDir` (from `discoverOpenSpecWorkspace`, not reconstructed
from a raw user-typed name) and an `archived` flag. Both
`ChangesTreeProvider.getChildren`/`ArchiveTreeProvider.getChildren`
already duplicate near-identical artifact-expansion logic for a
`ChangeTreeItem` element (`archive-tree.ts` literally mirrors
`changes-tree.ts`'s artifact-mapping block).

`task-templates.ts`'s own comment explains the existing security pattern
this change follows: "`changeName` is never used to build a path
directly... a crafted name cannot escape [the workspace]" — paths always
come from `discoverOpenSpecWorkspace`'s own allowlisted `artifacts[]`,
never from joining a caller-supplied string onto a directory.
`change-state.ts` already has a `TASK_CHECKBOX_RE` regex for *counting*
checked/unchecked tasks, but nothing in core extracts individual tasks
with a line number.

No existing command in this codebase does "reveal a specific line in an
open/to-be-opened editor" (`TextEditorRevealType`, `editor.selection`) —
the closest precedent, `ArtifactTreeItem`'s `.command = { command:
"vscode.open", ... }`, only opens a file, it does not jump to a line.

## Goals / Non-Goals

**Goals:**
- Both trees stay one shared `getChangeChildren` implementation, not two
  independently-maintained copies — closes an existing duplication gap
  (artifacts) while adding tasks, rather than duplicating the new logic a
  third time.
- Delete never removes the wrong line, even if the tree is stale relative
  to a file edited outside the tree (another editor, a CLI agent run, git
  pull) since the tree was last refreshed.

**Non-Goals:**
- No task *editing* (checking/unchecking, renaming) from the tree — only
  reveal (both trees) and delete (active only). Marking a task done is
  already possible by editing `tasks.md` directly (the checkbox syntax is
  the same convention already used everywhere in this repository); adding
  a second, tree-driven way to toggle it is a separate, unrequested
  feature.
- No conflict resolution if `tasks.md` is open with unsaved edits when a
  delete happens elsewhere (CLI, another window). This is an existing,
  already-accepted risk class in this codebase — `deleteChange` already
  deletes files that could be open in an editor with no special handling
  — not a new gap introduced here.
- No standalone/webui equivalent. See proposal.md's Impact — deferred as
  a clean follow-up, not out of scope by principle.

## Decisions

### `deleteTaskLine` re-verifies the exact line's text before deleting, not just its index

The tree's `TaskTreeItem` line numbers are a snapshot from the last
`getChildren()` call; the real file can change before the user clicks
Delete (their own edit, a CLI agent run, another window). Rejected
trusting the stored line number blindly: an off-by-N delete after the
file shifted would silently remove the *wrong* task — a correctness bug
users would not immediately notice (task text just gone, no error).
Instead, `deleteTaskLine` re-reads the file fresh at delete time, checks
that the target line still parses as a checkbox item whose description
text exactly matches what the tree captured, and only then removes it;
otherwise it throws `TaskListChangedError` (shown as a warning, "refresh
and try again") — fails closed, matching this repository's own
fail-closed philosophy (`docs/adr/0006-fail-closed-journal-compatibility.md`).

Rejected content-only matching (search the whole file for the first line
with matching text, ignore the stored line number entirely): silently
ambiguous when two tasks share identical text (e.g. copy-pasted
sub-tasks) — could delete a different occurrence than the one the user
actually clicked. Line-number-plus-text-verification is unambiguous and
still self-healing (the tree refreshes and the next click gets a fresh,
correct line number) without guessing across duplicates.

### Reveal degrades gracefully instead of failing closed

Unlike delete, revealing a task is non-destructive — if the stored line
number no longer matches (file changed since last refresh), falling back
to a whole-file search for the first line with matching text (and, if
that also fails, just opening the file at the top) is the better
trade-off: showing *something* useful beats blocking on a warning dialog
for a read-only navigation action.

### Shared `getChangeChildren(workspaceRoot, element)` exported from `changes-tree.ts`, reused by `archive-tree.ts`

`archive-tree.ts` already imports `ArtifactTreeItem`/`ChangeTreeItem`/
`EmptyTreeItem` from `changes-tree.js` — extending that existing reuse
pattern to the children-computation logic itself (which was, before this
change, independently duplicated in both files) removes an existing
drift risk instead of adding a third copy of increasingly complex
children logic.

### `openspec-ui.revealTask` is not exposed via `contributes.commands`

It only makes sense with a specific `TaskTreeItem` argument (which
Command Palette invocation cannot supply); `deleteTask` reads `item ??
return` too but is deliberately still exposed in `contributes.commands`
because the context-menu `when`-clause needs a Palette-registered command
id to bind to — `revealTask` is wired only via each `TaskTreeItem`'s own
`.command` property, matching the (also `contributes.commands`-absent)
generic `vscode.open` command already used the same way by
`ArtifactTreeItem`.

## Risks / Trade-offs

- **[Risk]** Parsing `tasks.md` client-side (regex over raw file content)
  instead of via the `openspec` CLI's own `status --json` command could
  drift from how the CLI itself defines "a task" if its checklist
  convention ever changes. → **Mitigation**: accepted; `change-state.ts`
  already has this exact same class of direct-regex dependency
  (`TASK_CHECKBOX_RE`) for counting, so this isn't a new coupling, just a
  second, consistent use of it.
- **[Risk]** Large `tasks.md` files (hundreds of tasks) render every task
  as a tree node with no pagination/grouping. → **Mitigation**: accepted
  for now — no repository's `tasks.md` in this project's own history has
  approached that scale; revisit only if it becomes a real problem.

## Migration Plan

- No data migration; purely additive (new tree children, two new
  commands, one new core module).
- Version bump (minor) for `@openspec-ui/core`, `openspec-ui-vscode`.
- Rollback: revert the package changes together; no persisted state
  beyond `tasks.md` edits a user explicitly made via "Delete Task."
