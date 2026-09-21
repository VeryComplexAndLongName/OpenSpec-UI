## MODIFIED Requirements

### Requirement: What is waiting on a person is readable in every host

Unticked items that no implementing agent will close SHALL be readable
in every host, naming the change each belongs to and who each waits on.

A judgement **deferred** from a change SHALL be collected too, from a
single list the workspace keeps, and SHALL name the change that raised
it. A judgement about a shipped thing outlives the change that shipped
it, and holding a change open until somebody makes that judgement is
what left six changes active for a day.

The archive SHALL NOT be read for this. Measured on 2026-09-20, this
repository's 285 archived changes hold 1.76 MB of task lists: 309 ms to
read and 74 ms merely to `stat`, on every collection, to find one
deferred judgement.

A change waiting on a live check and a change nobody has started are the
same row in a list of changes: both are in progress with a task open.
Telling them apart by opening each change's task file does not scale, and
this repository has already been asked to.

An item SHALL say whether it waits on a person or on a named agent. "No
agent can make this check" and "the agent running this change cannot
make it" are different facts, and only the first is a question for a
person. An item naming an agent SHALL name it by its registry id, and an
id that is not registered SHALL be reported as unknown rather than
counted as delegated - an item delegated to nobody looks assigned and is
not.

An item that names an agent SHALL also state the evidence that agent
must record, and SHALL be ticked only with that evidence recorded beside
it. An agent asked to confirm that something works will confirm that it
works; an agent asked to quote a line either has it or does not.

The collecting SHALL be done in one place both hosts read. Two walks over
the same files drift into two answers about the same workspace.

#### Scenario: A change waiting on a live check

- **WHEN** an active change has an unticked item that no implementing
  agent will close
- **THEN** it is listed as waiting, naming the change, the item, and who
  it waits on

#### Scenario: An item delegated to an agent

- **WHEN** an active change has an unticked item naming a registered
  agent
- **THEN** it is listed as waiting on that agent, distinctly from the
  items waiting on a person

#### Scenario: An item naming an agent that is not registered

- **WHEN** an unticked item names an agent id the registry does not
  carry
- **THEN** it is reported as waiting on an unknown agent, not counted as
  delegated

#### Scenario: Nothing waiting

- **WHEN** no active change has such an unticked item
- **THEN** the surface says nothing is waiting, and how many changes it
  read

#### Scenario: The collecting fails

- **WHEN** the task files of a workspace cannot be read
- **THEN** the surface says the inbox could not be read, and why, rather
  than showing no block

#### Scenario: A deferred judgement outlives its change

- **WHEN** a change with a deferred item is archived
- **THEN** the judgement is still collected, from the workspace's
  deferred list, naming the change that raised it

## ADDED Requirements

### Requirement: Work that is finished and did not land is said so

Where every item of a change is closed, a host SHALL say so plainly
when the work did not land:

- the change has no pull request at all, which means the work exists
  only in a working directory and has left no other trace;
- the change's pull request was closed without merging, which means the
  work was declared done and then rejected.

Neither SHALL be said where pull requests could not be read: a source
that did not answer is not evidence of absence.

#### Scenario: Finished, and never pushed anywhere

- **WHEN** a change's items are all closed and no pull request exists
  for it
- **THEN** the host says the work never left this machine

#### Scenario: Finished, and rejected

- **WHEN** a change's items are all closed and its pull request was
  closed without merging
- **THEN** the host says so

#### Scenario: Pull requests could not be read

- **WHEN** the pull request source did not answer
- **THEN** neither is said
