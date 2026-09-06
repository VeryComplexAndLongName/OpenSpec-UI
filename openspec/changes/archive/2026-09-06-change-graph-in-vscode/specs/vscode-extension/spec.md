## ADDED Requirements

### Requirement: The relation between changes is visible in the editor

The extension SHALL present the relation changes state about each other,
read through the shared core module rather than parsed again.

That presentation SHALL be separate from the list where changes are
acted on. A relation graph shows a change once per parent, and a working
list must show it once — duplicated rows carrying Archive or Rollback
would offer the same destructive action several times for one change.

A change waiting on another that has not yet landed SHALL be presented as
waiting, so that what can be started now is answerable without opening a
file.

From a change, a reader SHALL be able to reach what that change follows,
without first locating it in the graph.

#### Scenario: Reading the graph

- **WHEN** the relation view is opened
- **THEN** it shows changes under the ones they follow, marking archived
  ones, and offers no action that mutates a change

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
