## MODIFIED Requirements

### Requirement: A node says what state its change is in, and who is running it

Each node SHALL state whether its change is running, ready to start, or
blocked.

A change SHALL be running in either of these cases:

- a mutating run holds the working directory that belongs to the change;
- a run's status record that is not past the staleness window names the
  change from this working directory or from the change's own working
  directory.

A record that names the change from any other working directory SHALL NOT
make the change running.

A running change SHALL name where it is running. Where a lease recorded
the git author of the run, the node SHALL name that author, as attribution:
described as a git author, and never as an established identity. Where only
a status record says the change is running, the node SHALL claim nothing
about who is running it.

A blocked change SHALL name what it is waiting on. A change that is ready
SHALL name what it can be started alongside.

#### Scenario: A change being implemented

- **WHEN** a run holds a change's working directory and its lease
  recorded a git author
- **THEN** the node says the change is running and names that author

#### Scenario: A run whose lease recorded no author

- **WHEN** a run holds a change's working directory and no git identity
  was recorded
- **THEN** the node says the change is running, and claims nothing about
  who is running it

#### Scenario: A run that holds no lease

- **WHEN** a live status record names a change from this working
  directory, and no lease is held for that change
- **THEN** the node says the change is running there, and claims nothing
  about who is running it

#### Scenario: A copy of the change somewhere else

- **WHEN** a live status record names the change from a working directory
  that is neither this one nor the change's own
- **THEN** that record does not make the change running

#### Scenario: A run that stopped reporting

- **WHEN** the only record naming the change is past the staleness window
- **THEN** that record does not make the change running

## ADDED Requirements

### Requirement: A change is drawn once, beside the worktree that belongs to it

Where a working directory is the one that belongs to a change of this
working directory, the part of the picture showing the other directories
SHALL NOT draw that change again inside it, and SHALL say that the
directory belongs to that change.

That directory's other changes, its branch and its runs SHALL still be
shown.

#### Scenario: A change with its own worktree

- **WHEN** a change of this working directory has a worktree of its own
- **THEN** the change is drawn once, and that worktree is described as
  belonging to it

#### Scenario: A worktree that inherited other changes

- **WHEN** a change's own worktree also holds other changes
- **THEN** those other changes are still drawn under that worktree
