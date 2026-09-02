## ADDED Requirements

### Requirement: A chain decides its stages from task completion, not artifact presence

A chain SHALL determine whether implementation work remains from the
change's own task list, not from whether its artifact files exist. When
task completion cannot be determined, the chain SHALL choose the
implementation stage rather than the archive stage, so an unknown signal
never selects the irreversible one.

Before archiving, a chain SHALL refuse when any task remains incomplete,
reporting how many remain. A stage's own successful termination SHALL NOT
by itself be treated as evidence that the change is ready to archive.

#### Scenario: Every artifact file exists but no task is done

- **WHEN** a chain starts on a change whose proposal, design, tasks and
  spec files all exist and whose tasks are all incomplete
- **THEN** it starts at the implementation stage, and does not archive

#### Scenario: Task completion cannot be determined

- **WHEN** a chain cannot read the change's task list
- **THEN** it starts at the implementation stage rather than archiving

#### Scenario: Tasks remain incomplete at the archive stage

- **WHEN** a chain reaches the archive stage while at least one task is
  incomplete
- **THEN** nothing is archived, and the chain fails with a message naming
  the change and how many tasks remain

#### Scenario: Every task is complete

- **WHEN** a chain reaches the archive stage and no task remains
  incomplete
- **THEN** the change is archived, as before
