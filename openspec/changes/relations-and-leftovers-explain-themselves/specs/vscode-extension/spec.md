## MODIFIED Requirements

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
one. An entry that opens only to say there is nothing to remove is a
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
