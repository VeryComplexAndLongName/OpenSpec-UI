## ADDED Requirements

### Requirement: A delegated item can be run by the agent it names

Where a task names an agent and is not yet done, the surfaces that list
it SHALL be able to run that agent against that item, and the run SHALL
go through the same allowlist, working-directory sandbox and audit log
as every other agent run.

A name that nothing dispatches is a label. The marking exists so the
work reaches somebody other than the person reading the list, and until
something acts on it, a person drives every run by hand.

One item SHALL be run per request, asked for deliberately. Fanning out
across a change's items is a different question, with a different
argument about isolation.

A change MAY state which agent a particular task uses, in its own
configuration file, keyed by the task's number. That statement SHALL
take precedence over the task text. It SHALL NOT be settable for the
workspace: a numbered task belongs to one change, so the same statement
made workspace-wide is about a task in some other change.

Where the file and the task text name different agents, both SHALL be
reported rather than one silently winning. Where the file names a task
number no open line carries, that SHALL be reported as unmatched.

An item marked as needing a person SHALL NOT be offered a run. An item
naming an agent this build does not recognise SHALL be refused before
anything is started, naming the id.

The audit entry for such a run SHALL carry the change and the task
number.

#### Scenario: Running an item that names an agent

- **WHEN** an open item naming a registered agent is run from either
  host
- **THEN** that agent runs against that item, under the same
  constraints as any stage, and the audit entry names the change and
  the task

#### Scenario: An item that waits on a person

- **WHEN** an open item is marked as needing a person
- **THEN** no run is offered for it

#### Scenario: An agent the registry does not carry

- **WHEN** an item names an agent id this build does not recognise
- **THEN** the run is refused before anything is started, naming the id

#### Scenario: The file and the text disagree

- **WHEN** a change's configuration names one agent for a task and the
  task text names another
- **THEN** the configuration is used and both are reported

#### Scenario: A configured task that does not exist

- **WHEN** a change's configuration names a task number no open line
  carries
- **THEN** it is reported as unmatched

### Requirement: An item cannot be closed by being ticked in silence

Where an agent runs against a delegated item, the item's text SHALL be
read before the run and compared after. An item that became ticked
while saying nothing it did not say before SHALL have the tick
reverted, and the run SHALL be reported as refused, naming why.

An agent asked to confirm that something works will confirm that it
works. The evidence rule is what makes a delegated item closeable, and
the cheapest way to break it is to tick the box and write nothing.

What this checks SHALL be stated where the outcome is shown. Nothing
mechanical can judge whether written evidence is true, and a gate that
passed SHALL NOT be presented as a verified claim.

#### Scenario: A tick with nothing written

- **WHEN** a run leaves an item ticked and its text otherwise unchanged
- **THEN** the tick is reverted and the refusal says why

#### Scenario: A tick with evidence written

- **WHEN** a run leaves an item ticked and its text carrying more than
  it did
- **THEN** the item is left as written, and the surface says only that
  something was recorded, not that it was checked
