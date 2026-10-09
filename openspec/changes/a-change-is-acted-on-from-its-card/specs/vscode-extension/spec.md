## ADDED Requirements

### Requirement: A change's row offers the actions its card does

The Changes tree SHALL offer a change, on its row, the same actions its
card does, from the same list in `packages/core` (ADR 0044): neither
surface SHALL have an action on a change that the other lacks. A row's
menu SHALL open with Show Actions..., which lists every action grouped by
its verb's group, each one that cannot run now saying why; then what
runs; then Inspect and Set Up as submenus; and the Danger actions last.
Show Actions... SHALL also be an icon on the row.

A row of a change worked in another working directory SHALL offer every
action a row of this checkout does, and each SHALL run in that directory.
A test SHALL hold the manifest's menus, titles and icons to core's list.

#### Scenario: The menu of a change

- **WHEN** a person right-clicks a change in the Changes tree
- **THEN** Show Actions... is first, the actions that run follow, Inspect
  and Set Up open as submenus, and Archive, Rollback and Delete are last

#### Scenario: A change in its own worktree, from the main checkout

- **WHEN** a person opens Configure Change Harness on a change worked in
  its own worktree
- **THEN** that worktree's `harness.json` is created where it is missing,
  and the change's harness panel reads and writes it there

## MODIFIED Requirements

### Requirement: The Changes tree says whose each change is

The Changes tree SHALL draw this working directory's own change first, and
the view's description SHALL name that change.

For each change that is worked in another working directory, the tree
SHALL draw a greyed icon of a branch and SHALL say in the item's description
which directory it is worked in and, where a verified record names one,
which person. The whole sentence SHALL also be the item's tooltip. A change
no directory has taken up SHALL keep its standing's icon, colour and menu.

The per-change commands SHALL be offered on an item worked in another
working directory as on any other, and each SHALL act in that directory
(ADR 0044, a-change-is-acted-on-from-its-card). A command that writes
SHALL refuse only where the records reporting from that directory do not
check out, naming the directory to work in instead.

Where this checkout has no change of its own, the view SHALL say so and
SHALL say how many changes are being worked in other working directories,
with a press that opens the Pipeline.

These readings SHALL come from the survey the tree already takes: no
additional watcher, and no additional git invocation.

#### Scenario: A fresh working directory holds somebody else's changes

- **WHEN** a directory is cut from the default branch while other changes
  are active there
- **THEN** its own change is first and named in the view's description,
  and the others are drawn greyed, naming the directories they are worked
  in

#### Scenario: A writing command on a change worked elsewhere

- **WHEN** Archive Change is invoked on a change worked in its own worktree
- **THEN** the change is archived in that worktree, and this checkout's
  copy is not written

#### Scenario: A writing command reached another way

- **WHEN** a command that would write to a change is invoked from the
  palette while that change is worked in a directory whose records do not
  check out
- **THEN** it refuses, names that directory, and writes nothing

#### Scenario: The main checkout while the work is elsewhere

- **WHEN** the main working directory has no change of its own and four
  are worked in other directories
- **THEN** the view says so, says how many, and offers to open the
  Pipeline

### Requirement: The relation between changes is visible in the editor

The extension SHALL present the relation changes state about each other,
read through the shared core module rather than parsed again.

That presentation SHALL be separate from the list where changes are
acted on. A relation graph shows a change once per parent, and a working
list must show it once - duplicated rows carrying Archive or Rollback
would offer the same destructive action several times for one change.

A change waiting on another that has not yet landed SHALL be presented as
waiting, so that what can be started now is answerable without opening a
file.

From a change, a reader SHALL be able to reach what that change follows,
without first locating it in the graph.

A reader SHALL be able to add and remove a change's stated relations from
the row that shows them, choosing the kind of relation and the change it
names from lists rather than typing an id. Editing the metadata file by
hand was the only way to state a relation, and the mistakes it invites -
an id that matches no change, a cycle - were caught only by the lint gate,
after the author had moved on.

Those edits SHALL go through core, which owns the file and the refusal.
The presentation SHALL show a refusal in words the reader can act on,
naming the changes in a cycle and the id that matches nothing.

An archived change's relations SHALL be drawn and never edited.

A directory under `openspec/changes/` that holds no document yet, and
whose name no archived change has, SHALL take the same two edits. Its
relations live in the metadata file it may already hold, and ordering work
before writing it is when a relation is most useful. Its row SHALL say
that the rest of a change's actions arrive with its first document.

Removing a relation SHALL be offered only on a row whose change states
one, and on a row of a change worked in another working directory, whose
relations are read there (a-change-is-acted-on-from-its-card). An entry that opens only to say there is nothing to remove is a
question whose every answer is no.

#### Scenario: A change not written yet

- **WHEN** a reader right-clicks a directory holding only its metadata
  file, with no archived change of its name
- **THEN** adding a relation is offered, and its row says the other
  actions arrive with a proposal, design, tasks or specs

#### Scenario: Nothing to remove

- **WHEN** a change states no relation
- **THEN** its row does not offer to remove one, and does again once a
  relation is stated

#### Scenario: Reading the graph

- **WHEN** the relation view is opened
- **THEN** it shows changes under the ones they follow, marking archived
  ones, and offers no action that mutates a change's contents or lifecycle

#### Scenario: A change with more than one parent

- **WHEN** a change states that it follows more than one change
- **THEN** it appears under each, because the relation is a graph and
  dropping an edge would hide half of why the change exists

#### Scenario: A change waiting on another

- **WHEN** a change states a blocking relation on a change that is still
  active
- **THEN** it is presented as waiting on it

#### Scenario: Asking why a change exists

- **WHEN** a reader asks, from a change, what it follows
- **THEN** the chain back to the changes it grew out of is presented

#### Scenario: The working list is unchanged

- **WHEN** changes are listed for work
- **THEN** each appears once, with its actions, as before

#### Scenario: Stating a relation from the row

- **WHEN** a reader adds a relation on a change's row, picking the kind
  and the change it names
- **THEN** the change's metadata states it and both views are drawn again,
  with the waiting-on word where the relation was a blocking one

#### Scenario: Taking one back

- **WHEN** a reader removes a relation from the row that shows it
- **THEN** only the relations that change actually states are offered, and
  the chosen one is gone from the metadata and from the views

#### Scenario: An edit the gate would fail

- **WHEN** an edit names a change the workspace does not have, or would
  close a cycle
- **THEN** it is refused before anything is written, in words naming the
  id or the changes in the cycle

#### Scenario: An archived row

- **WHEN** the row acted on is an archived change
- **THEN** no relation edit is offered on it
