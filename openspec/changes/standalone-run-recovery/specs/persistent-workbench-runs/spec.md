## ADDED Requirements

### Requirement: Recovery behavior is transport-neutral

The system SHALL expose process history, checkpoint details, conflict-safe
rollback, and retention cleanup through a core service reusable by every
delivery target.

#### Scenario: A host starts after an unfinished run

- **WHEN** the recovery service loads a journal containing a queued or running process
- **THEN** it marks the process interrupted, finalizes its checkpoint for review, and persists the recovered state

#### Scenario: Files changed after checkpoint finalization

- **WHEN** a user requests rollback and current files do not match the finalized checkpoint
- **THEN** the service reports conflicts and does not partially restore files

### Requirement: Run retention removes matching checkpoint data

The system SHALL remove checkpoint sessions whenever their retained process is
removed so journals contain no orphaned recovery data.

#### Scenario: User cleans old history

- **WHEN** processes older than the requested cutoff are removed
- **THEN** their checkpoint sessions are removed in the same journal update
