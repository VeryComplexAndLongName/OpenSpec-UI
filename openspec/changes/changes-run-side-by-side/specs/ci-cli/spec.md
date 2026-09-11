## ADDED Requirements

### Requirement: A change can be given its own working directory

The CLI SHALL provide commands to create, list and remove a separate
working directory of the repository for one change, on a branch named
after that change.

Creating one SHALL refuse, changing nothing, where the change is not
present in the commit the directory would be cut from, where the branch
already exists, or where the directory already exists. A change that
exists only as uncommitted files would produce a working directory
without the change it was created for.

Creating one SHALL report the command that runs the chain there, because
the path is long and running it is the next thing to happen.

Removing one SHALL refuse where it holds uncommitted work.

#### Scenario: Giving a change its own directory

- **WHEN** a working directory is created for a committed change
- **THEN** it exists, is on a branch named after the change, contains
  that change, and the command to run the chain there is reported

#### Scenario: A change that was never committed

- **WHEN** a working directory is requested for a change that is not in
  the base commit
- **THEN** it is refused, nothing is created, and the message says to
  commit the change first

#### Scenario: A name already in use

- **WHEN** the branch or the directory already exists
- **THEN** it is refused and nothing existing is altered

#### Scenario: Removing one that still holds work

- **WHEN** removal is requested for a directory with uncommitted changes
- **THEN** it is refused, and the work is left where it is

#### Scenario: Listing them

- **WHEN** the working directories are listed
- **THEN** each is shown with the change it belongs to, and those whose
  change is no longer active are marked

### Requirement: Changes in separate working directories run at the same time

Two chains running in two working directories of one repository SHALL NOT
wait for each other.

The cross-host workspace lease SHALL be held per working directory. That
is what makes it the isolation boundary rather than a queue for the
repository — a second run in a second directory takes its own lease and
proceeds.

#### Scenario: Two changes at once

- **WHEN** a chain is running in one working directory and a chain is
  started in another for a different change
- **THEN** the second starts rather than being refused for the workspace
  being held

#### Scenario: Two runs in one directory

- **WHEN** a second run is started in a working directory whose lease is
  held
- **THEN** it is refused, exactly as it is today

### Requirement: One repository has one spending ceiling

Where a spending ceiling is configured, the total it is measured against
SHALL include what was recorded in every working directory of the
repository, not only the one the run is in.

A ceiling measured per working directory would permit itself once per
directory, so a repository with three of them would silently allow three
times what was configured.

A recorded log that cannot be read SHALL be skipped rather than failing
the run. A directory that has been removed, or belongs to somebody else,
is not a reason to refuse to start.

#### Scenario: Spending recorded in a sibling directory

- **WHEN** a chain checks its budget and another working directory of the
  same repository has recorded usage for that change
- **THEN** that usage counts towards the ceiling

#### Scenario: A sibling's log cannot be read

- **WHEN** one working directory's recorded log cannot be read
- **THEN** the total is made from the ones that can, and the run starts
