## ADDED Requirements

### Requirement: Recording process state does not rewrite checkpoint data

Checkpoint data SHALL be stored separately from process history, one store
per checkpoint session.

Recording a change to a process's state SHALL NOT read, serialize, or
rewrite any checkpoint's captured file contents.

A finalized checkpoint SHALL be written once and SHALL NOT be rewritten
afterwards.

#### Scenario: A process changes state while checkpoints are retained

- **WHEN** a process's state is recorded and checkpoint sessions are
  retained
- **THEN** only the process history is written, and no retained
  checkpoint's stored data is rewritten

#### Scenario: The same checkpoint is persisted twice

- **WHEN** process history is written again while a finalized checkpoint
  is still retained
- **THEN** that checkpoint's store is left as it is

### Requirement: A checkpoint store is written before it is referenced

A checkpoint's own store SHALL be written before process history refers to
it.

Process history SHALL NOT refer to a checkpoint whose store has not been
written.

#### Scenario: Interruption between the two writes

- **WHEN** the system stops after writing a checkpoint's store but before
  recording the reference to it
- **THEN** the stored checkpoint is left unreferenced, and process history
  promises no rollback that cannot be performed

### Requirement: A missing checkpoint store does not fail recovery

When process history refers to a checkpoint whose store cannot be read,
the system SHALL load the process history and SHALL report that process as
having no recoverable checkpoint.

Stored checkpoints that no process history refers to SHALL be removed.

#### Scenario: A referenced checkpoint is unreadable

- **WHEN** process history refers to a checkpoint whose store is missing
  or unreadable
- **THEN** the history loads, that process is reported without a
  checkpoint, and every other process is reported as before

#### Scenario: An unreferenced checkpoint store

- **WHEN** a stored checkpoint is not referred to by any process history
- **THEN** it is removed

#### Scenario: Retention removes a process

- **WHEN** retention removes a process that had a checkpoint
- **THEN** that checkpoint's store is removed with it

### Requirement: Existing process history is migrated, not discarded

Process history written in the previous storage layout SHALL be readable,
and its checkpoints SHALL be preserved by moving them into their own
stores.

History written in a layout the system does not support SHALL continue to
be reported as unsupported, naming the versions involved.

#### Scenario: History in the previous layout

- **WHEN** process history in the previous layout is loaded
- **THEN** its checkpoints are preserved in the new layout and the history
  loads with the same processes and checkpoints it held before

#### Scenario: History in an unsupported layout

- **WHEN** process history declares a layout the system does not support
- **THEN** it is reported as unsupported, naming what was found and what
  is supported, as before
