## MODIFIED Requirements

### Requirement: Changes and Archive trees expand to individual tasks, with reveal and scoped delete

Expanding a change node in either the "Changes" or "Archive" tree view
SHALL also list that change's individual `tasks.md` checklist items as
child tree items, alongside its existing artifact children, nested
under that change and independently collapsible/expandable. Every tree
item in these views SHALL have a stable identity derived from data
already unique at its scope (not label-derived, not dependent on object
identity surviving a refresh), distinct from its parent's identity, so
that nesting and collapse state survive tree refreshes. Selecting a task
item SHALL open (or reveal, if already open) `tasks.md` with the cursor
moved to that task's line, in both trees. A "Delete Task" action SHALL
be available only on task items belonging to an active (non-archived)
change; selecting it, after confirmation, SHALL remove exactly that
task's checklist line from the change's `tasks.md`. Task items belonging
to archived changes SHALL NOT offer a delete action.

#### Scenario: Expanding an active change shows its tasks

- **WHEN** the user expands a change node in the "Changes" tree
- **THEN** its individual `tasks.md` checklist items appear as child
  items alongside the existing artifact children

#### Scenario: Task identity is distinct from its parent Change

- **WHEN** a change node's children are computed
- **THEN** each task item's id is distinct from the parent Change's own
  id and from every sibling's id

#### Scenario: Selecting a task reveals it in the editor

- **WHEN** the user selects a task tree item (in either tree)
- **THEN** `tasks.md` opens (or is revealed, if already open) with the
  cursor at that task's line

#### Scenario: Deleting a task from an active change

- **WHEN** the user confirms "Delete Task" on a task belonging to an
  active change
- **THEN** that exact line is removed from the change's `tasks.md`

#### Scenario: Archived tasks offer no delete action

- **WHEN** the user views a task item under the "Archive" tree
- **THEN** no delete action is available for it

#### Scenario: The underlying file changed since the tree was last refreshed

- **WHEN** the user attempts to delete a task whose stored position no
  longer matches the current content of `tasks.md`
- **THEN** the system reports that the task list has changed and makes no
  filesystem change, rather than risking deletion of a different line
