## ADDED Requirements

### Requirement: What is waiting on a person is readable in every host

Unticked human-only items across the active changes SHALL be readable in
every host, naming the change each belongs to.

A change waiting on a live check and a change nobody has started are the
same row in a list of changes: both are in progress with a task open.
Telling them apart by opening each change's task file does not scale, and
this repository has already been asked to.

The collecting SHALL be done in one place both hosts read. Two walks over
the same files drift into two answers about the same workspace.

An empty result SHALL say which empty it is: nothing waiting, or nothing
read.

Neither surface SHALL offer to tick an item. The point of a human-only
item is that a person did the thing; a control that records it without
that is a control for recording something untrue.

#### Scenario: A change waiting on a live check

- **WHEN** an active change has an unticked human-only task
- **THEN** it is listed as waiting, naming the change and the item

#### Scenario: Nothing waiting

- **WHEN** no active change has an unticked human-only task
- **THEN** the surface says nothing is waiting, and how many changes it
  read
