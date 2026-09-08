## ADDED Requirements

### Requirement: The release path runs one at a time

Runs that reach the release path SHALL NOT overlap. Where a run is
already in progress for the default branch, a later one SHALL wait for it
rather than start beside it.

The jobs on that path create a pull request, a tag and a release, and
push to a publishing branch — state outside the run. Two runs racing for
it fail in ways that read as defects in the release path: a reference
that does not exist, a tag that already does.

A run in progress for the default branch SHALL NOT be cancelled by a
later one. Stopping a run between creating a tag and publishing its
release leaves a tag with nothing attached, which is worse than the race
and harder to notice than a wait.

A run for a pull request SHALL be superseded by a later run for the same
pull request. Its answer describes a commit that is no longer the one
under review.

#### Scenario: Two pushes to the default branch

- **WHEN** a push happens while a run for the default branch is in
  progress
- **THEN** the later run waits, and the earlier one finishes

#### Scenario: A release is in progress

- **WHEN** a run reaches the release path and another push arrives
- **THEN** the running release is not cancelled

#### Scenario: A pull request is pushed to again

- **WHEN** a new commit is pushed to a pull request whose run is still
  going
- **THEN** the earlier run is cancelled in favour of the new one

#### Scenario: Two unrelated pull requests

- **WHEN** runs exist for two different pull requests
- **THEN** neither waits for the other
