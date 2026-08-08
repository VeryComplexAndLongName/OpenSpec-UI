# OpenSpec Workbench Delta

## MODIFIED Requirements

### Requirement: Workbench visualizes concurrent processes

The Workbench SHALL visualize queued, running, completed, failed, cancelled,
interrupted, and rolled-back processes with operation, target change, progress,
and result details. It SHALL permit concurrent read-only operations but SHALL
serialize all workspace mutations until independent filesystem isolation is
available.

#### Scenario: Independent changes run concurrently

- **WHEN** a mutating operation is active for one change
- **AND** read-only operations are requested for independent changes
- **THEN** the read-only operations may execute concurrently
- **AND** each process is displayed independently

#### Scenario: Conflicting mutation is requested

- **WHEN** one mutating process is active and another mutation is requested for
  the same workspace
- **THEN** the second process is shown as queued
- **AND** it starts only after the active mutation reaches a terminal state

#### Scenario: Process history is restored

- **WHEN** the Workbench host reloads
- **THEN** persisted terminal processes remain visible
- **AND** unfinished processes are shown as interrupted rather than running

### Requirement: Mutating runs support scoped rollback

Before an AI-assisted mutation, the Workbench SHALL create a bounded checkpoint
that preserves pre-run user state and records any omitted rollback coverage.
After completion or interruption, the Workbench SHALL calculate the run delta
and offer review and explicit rollback. Rollback SHALL restore only run-owned
changes and SHALL refuse to overwrite later conflicting edits.

#### Scenario: User rolls back an uncontested run

- **WHEN** affected files still match their post-run fingerprints
- **AND** the user reviews and confirms the affected file list
- **THEN** files are restored to their pre-run state
- **AND** the process is marked rolled back

#### Scenario: A file changed after the run

- **WHEN** an affected file no longer matches its post-run fingerprint
- **THEN** rollback refuses to overwrite it
- **AND** identifies the conflicting file for manual resolution

#### Scenario: Checkpoint coverage is partial

- **WHEN** files are omitted because of checkpoint limits or excluded directory
  policy
- **THEN** the process details identify that rollback coverage is partial
- **AND** the omitted paths or directory classes are available for inspection

#### Scenario: Interrupted run is rolled back after reload

- **WHEN** an implementation run is restored as interrupted with a finalized
  delta
- **AND** no affected file changed after recovery finalization
- **THEN** the user can explicitly restore the pre-run state
