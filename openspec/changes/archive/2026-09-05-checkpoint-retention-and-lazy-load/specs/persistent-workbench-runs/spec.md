## ADDED Requirements

### Requirement: Restoring runs does not read what it does not need

Restoring persisted runs at startup SHALL read what is needed to list
them, and SHALL NOT read the captured content of a checkpoint that
nothing has asked for.

The cost of restoring SHALL NOT grow with the number of checkpoints
retained on disk.

A checkpoint's content SHALL be read when a rollback or a delta is
requested for it, and a failure to read it then SHALL be reported where
the request was made.

#### Scenario: Startup with many retained checkpoints

- **WHEN** runs are restored and many retained checkpoints exist on disk
- **THEN** their captured content is not read, and restoring costs the
  same as it would with none

#### Scenario: A rollback is requested

- **WHEN** a rollback is requested for a retained run
- **THEN** that checkpoint's content is read at that moment, and the
  rollback produces the same result as before this requirement

#### Scenario: An interrupted run needs its delta

- **WHEN** a restored run was interrupted and has no reviewable delta yet
- **THEN** its checkpoint is resolved during restore, because that is
  what makes the run reviewable

### Requirement: Retained checkpoints are bounded on their own terms

The number of retained checkpoints SHALL be bounded by its own limit,
separate from the limit on retained run history.

Retention SHALL be decided by recency, and SHALL NOT be decided by a
run's final state: a run that finished is still one the system offers to
roll back.

A checkpoint outside the bound SHALL have its stored content deleted, and
a run whose content has been deleted SHALL still list without error.

#### Scenario: More checkpoints than the bound

- **WHEN** more checkpoints exist than the bound allows
- **THEN** the most recent are kept, the rest have their content deleted,
  and every run still lists

#### Scenario: A finished run inside the bound

- **WHEN** a run that completed successfully is inside the retention
  bound
- **THEN** its checkpoint is kept and its rollback still works

#### Scenario: A run whose content was evicted

- **WHEN** a run's checkpoint content has been deleted by retention
- **THEN** the run still appears in the run history, and no rollback is
  offered for it
