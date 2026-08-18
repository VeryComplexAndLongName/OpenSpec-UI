## MODIFIED Requirements

### Requirement: Changes and Archive trees expand to individual tasks, with reveal and scoped delete

Expanding a change node in either the "Changes" or "Archive" tree view
SHALL list that change's artifacts as child tree items. The `tasks.md`
artifact SHALL be collapsible when the file exists (a plain leaf, like
every other artifact, when it doesn't), and expanding *it* — not the
change node — SHALL list that change's individual `tasks.md` checklist
items as its children; task items SHALL NOT appear as direct children
of the change node itself. Every tree item in these views SHALL have a
stable identity derived from data already unique at its scope (not
label-derived, not dependent on object identity surviving a refresh),
distinct from its parent's identity, so that nesting and collapse state
survive tree refreshes. Selecting a task item SHALL open (or reveal, if
already open) `tasks.md` with the cursor moved to that task's line, in
both trees. A "Delete Task" action SHALL be available only on task
items belonging to an active (non-archived) change that are not marked
done; selecting it, after confirmation, SHALL remove exactly that
task's checklist line from the change's `tasks.md`. Task items
belonging to archived changes, and done task items in active changes,
SHALL NOT offer a delete action.

#### Scenario: Expanding an active change shows its tasks

- **WHEN** the user expands a change node in the "Changes" tree
- **THEN** its artifacts appear as child items, and the "Tasks" artifact
  is collapsible while every other artifact is not

#### Scenario: Individual tasks nest under Tasks, not under the change directly

- **WHEN** the user expands the "Tasks" artifact under a change
- **THEN** that change's individual `tasks.md` checklist items appear as
  its children, and none of them appeared as direct children of the
  change node itself

#### Scenario: Task identity is distinct from its parent Change

- **WHEN** the Tasks artifact's children are computed
- **THEN** each task item's id is distinct from the Tasks artifact's own
  id, from the parent Change's id, and from every sibling's id

#### Scenario: Selecting a task reveals it in the editor

- **WHEN** the user selects a task tree item (in either tree)
- **THEN** `tasks.md` opens (or is revealed, if already open) with the
  cursor at that task's line

#### Scenario: Deleting a task from an active change

- **WHEN** the user confirms "Delete Task" on a task belonging to an
  active change that is not marked done
- **THEN** that exact line is removed from the change's `tasks.md`

#### Scenario: Archived tasks offer no delete action

- **WHEN** the user views a task item under the "Archive" tree
- **THEN** no delete action is available for it

#### Scenario: Done tasks offer no delete action, even in active changes

- **WHEN** the user views a task item marked done (`- [x]`) under an
  active change in the "Changes" tree
- **THEN** no delete action is available for it, and invoking the delete
  command directly with that item makes no change to `tasks.md`

#### Scenario: The underlying file changed since the tree was last refreshed

- **WHEN** the user attempts to delete a task whose stored position no
  longer matches the current content of `tasks.md`
- **THEN** the system reports that the task list has changed and makes no
  filesystem change, rather than risking deletion of a different line
