## ADDED Requirements

### Requirement: A working directory on no branch is finished with where the default branch contains its commit

A surveyed working directory on no branch SHALL be reported as finished
with where the default branch already contains the commit it is at, its
tree is clean and no run is recorded against it. It SHALL be reported as
`merged` and SHALL name no branch.

It SHALL be offered for removal beside a press and SHALL NOT be removed by
a sweep: a directory on no branch cannot be told from one made a moment ago
for work still to come, and removing it unasked can take it from under
somebody.

#### Scenario: A detached directory at a commit main contains

- **WHEN** a directory is on no branch, at a commit the default branch
  contains, its tree is clean and no run is recorded against it
- **THEN** it is reported as finished with, naming no branch, and is
  offered for removal

#### Scenario: A detached directory ahead of main

- **WHEN** a directory is on no branch and its commit is not contained in
  the default branch
- **THEN** it is not reported as finished with

#### Scenario: A detached directory that holds work or a run

- **WHEN** such a directory's tree is not clean, or a run is recorded
  against it
- **THEN** it is not reported as finished with

#### Scenario: The sweep meets a detached directory

- **WHEN** the workspace sweep reads a directory on no branch
- **THEN** it keeps it, as it did, and removes nothing
