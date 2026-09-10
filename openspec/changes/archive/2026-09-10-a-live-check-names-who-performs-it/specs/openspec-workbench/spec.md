## MODIFIED Requirements

### Requirement: What is waiting on a person is readable in every host

Unticked items that no implementing agent will close SHALL be readable
in every host, naming the change each belongs to and who each waits on.

A change waiting on a live check and a change nobody has started are the
same row in a list of changes: both are in progress with a task open.
Telling them apart by opening each change's task file does not scale, and
this repository has already been asked to.

An item SHALL say whether it waits on a person or on a named agent. "No
agent can make this check" and "the agent running this change cannot
make it" are different facts, and only the first is a question for a
person. An item naming an agent SHALL name it by its registry id, and an
id that is not registered SHALL be reported as unknown rather than
counted as delegated — an item delegated to nobody looks assigned and is
not.

An item that names an agent SHALL also state the evidence that agent
must record, and SHALL be ticked only with that evidence recorded beside
it. An agent asked to confirm that something works will confirm that it
works; an agent asked to quote a line either has it or does not.

The collecting SHALL be done in one place both hosts read. Two walks over
the same files drift into two answers about the same workspace.

An empty result SHALL say which empty it is: nothing waiting, or nothing
read.

Where the collecting fails, the surface SHALL say that it failed and why,
in the place the count would have been. A failure rendered as an absent
block is indistinguishable from a block not yet loaded, which is the
distinction this surface exists to make.

Neither surface SHALL offer to tick an item. The point of such an item is
that the thing was done and recorded; a control that records it without
that is a control for recording something untrue.

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
