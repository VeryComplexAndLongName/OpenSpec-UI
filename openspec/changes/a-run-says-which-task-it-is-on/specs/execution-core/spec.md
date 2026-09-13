## ADDED Requirements

### Requirement: A run's record says which task it is on

Where a run has said which task it is on, its status record SHALL carry
that task and SHALL record that the run said so.

A run started for one task SHALL carry that task from the start and SHALL
record that the task was given to it. A later statement by that run naming
another task SHALL NOT replace it.

The task SHALL be written to the record when it is said, and SHALL NOT be
lost to a later line of output.

Only the agent's reply and its standard output SHALL be read for such a
statement. Its reasoning, and the descriptions of its tool calls, SHALL
NOT be read.

A statement SHALL be recognised only when it is a line of its own, in the
form the implementing instruction asks for.

#### Scenario: An agent says which task it is starting

- **WHEN** an agent prints a line saying it is starting task 1.2, followed
  by more output
- **THEN** the record says the run is on task 1.2 by its own account, and
  the activity is the latest line

#### Scenario: A statement inside a longer message

- **WHEN** one message from the agent contains the statement followed by
  further lines
- **THEN** the record says the run is on that task

#### Scenario: Reasoning that mentions a task

- **WHEN** the agent's reasoning contains a line in the form of the
  statement
- **THEN** the record names no task on that account

#### Scenario: A mention inside a sentence

- **WHEN** the agent writes that it is starting task 2.3 as part of a
  longer sentence
- **THEN** the record names no task on that account

#### Scenario: A run given one task

- **WHEN** a run is started for task 6.5 and its agent later says it is
  starting task 1.1
- **THEN** the record says the run is on task 6.5, the task it was given

### Requirement: A run's record says when it is waiting

Where a run is waiting at a checkpoint, or for a permission to be
answered, its status record SHALL say so and say what it is waiting for.
The record SHALL NOT describe such a run as running a stage.

The record SHALL stop saying so at the run's next event that is not
itself a wait.

#### Scenario: At a checkpoint

- **WHEN** a chain pauses at a checkpoint after a stage
- **THEN** the record says the run is waiting to continue to the next
  stage

#### Scenario: A permission request

- **WHEN** a run asks for a permission
- **THEN** the record says the run is waiting for that permission, and
  describes it

#### Scenario: Continuing

- **WHEN** a waiting run continues
- **THEN** the record no longer says it is waiting

### Requirement: A run's record carries the run's id

A run's status record SHALL carry the run id its host started the run
with, so that a surface can tell which of the host's runs the record
describes.

The record's own identity SHALL remain the one the run generated for
itself.

#### Scenario: A record and its run

- **WHEN** a host starts a run with a run id
- **THEN** the run's record carries that id, alongside its own identity

### Requirement: An older record is read, not refused

A status record written before the task, the wait and the run id were
recorded SHALL be read as naming none of them. It SHALL NOT be reported as
malformed on that account.

A malformed value in any of those three fields SHALL be read as absent,
and SHALL NOT make the record malformed.

#### Scenario: A record from before

- **WHEN** a record that has no task, wait or run id is read
- **THEN** it is reported as a run that names none of them, and not as
  malformed
