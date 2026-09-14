## MODIFIED Requirements

### Requirement: A surveyed directory shows what its runs say they are doing

For each working directory, the survey SHALL show what each run reporting
there says it is doing: its change, its stage, its activity, and how long
since it said so. These SHALL be read from the status records that runs
already write.

Where a run has said which task it is on, or was started for one task,
the survey SHALL name that task by its number and text, and SHALL say
which of the two applies. A task number that names no task of the run's
change SHALL NOT be shown.

Where a run is waiting at a checkpoint or for a permission, the survey
SHALL say that it is waiting and what for, and SHALL NOT describe it as
running a stage.

A run whose record is past the staleness window SHALL be shown as gone.

A directory where no run reports SHALL be described as such, and SHALL
NOT be described as idle: a session this product did not start writes no
record.

No verdict about a run's health SHALL be stated.

Reading the records SHALL NOT run git against any working directory beyond
the one enumeration the survey already makes.

#### Scenario: A run in another working directory

- **WHEN** a run in another working directory reports an activity
- **THEN** the survey shows that activity under that directory, with how
  long ago it was said

#### Scenario: A directory no run reports from

- **WHEN** no status record names a working directory
- **THEN** the survey says that no run reports there, and does not call
  the directory idle

#### Scenario: A record for a directory that is gone

- **WHEN** a status record names a path that is no longer a working
  directory of the repository
- **THEN** the record is reported as belonging to no directory, and is not
  dropped

#### Scenario: A run that said which task it is on

- **WHEN** a run's record says it is on task 1.2 by its own account, and
  the change's list has a task 1.2
- **THEN** the survey names task 1.2 with its text, and says the run said
  so

#### Scenario: A run that named a task its change does not have

- **WHEN** a run's record names task 9.9 and the change's list has no such
  task
- **THEN** the survey names no task for that run

#### Scenario: A run waiting at a checkpoint

- **WHEN** a run's record says it is waiting to continue to the next
  stage
- **THEN** the survey says the run is waiting, and does not say it is
  running a stage
