## ADDED Requirements

### Requirement: Working directories are created under one root

A change's working directory SHALL be created under a single configured
root, in a place that identifies both the repository and the change, so
that one root serves every repository.

The root SHALL be outside the repository.

Where nothing is configured, a default SHALL be used, so that creating a
working directory never requires configuration first.

#### Scenario: A working directory for a change

- **WHEN** a working directory is created for a change
- **THEN** it is placed under the root, under that repository

#### Scenario: Two repositories, one root

- **WHEN** changes of the same name exist in two repositories
- **THEN** each gets its own working directory and neither displaces the
  other

### Requirement: Where working directories live is a setting of the machine

The root SHALL be read from the environment and from a setting belonging
to the person, and SHALL NOT be read from the repository's own
configuration.

#### Scenario: A repository opened on another machine

- **WHEN** the same repository is opened by somebody else
- **THEN** their working directories go where they configured, not where
  anybody else did

### Requirement: Removing a working directory keeps its run history

Before a working directory is removed, the run history recorded in it
SHALL be merged into the repository's own.

Merging SHALL be repeatable without duplicating what it already took.

#### Scenario: Removing a directory that recorded runs

- **WHEN** a working directory holding run history is removed
- **THEN** that history is readable in the repository afterwards

#### Scenario: Removing a directory that recorded nothing

- **WHEN** a working directory holding no run history is removed
- **THEN** it is removed and nothing is reported as taken

### Requirement: Removal says what it discards

Where a working directory holds anything outside version control that is
not taken, removal SHALL name it.

#### Scenario: A directory holding rollback data

- **WHEN** a working directory holding checkpoints is removed
- **THEN** removal names them as discarded before removing the directory

### Requirement: Existing working directories are reported, never moved unasked

Working directories that already exist elsewhere SHALL be reported with
where they are.

They SHALL be relocatable on request, and SHALL NOT be moved as a side
effect of anything else.

Directories that this tool did not create SHALL NOT be moved or removed.

#### Scenario: A directory created under an older default

- **WHEN** a working directory exists outside the root
- **THEN** it is reported, and moving it requires asking

#### Scenario: A directory nothing here created

- **WHEN** a directory beside the repository is not a working directory
  of it
- **THEN** nothing here moves or removes it
