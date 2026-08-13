# persistent-workbench-runs Specification

## Purpose

Define durable Workbench process history, checkpoint recovery, workspace
mutation isolation, rollback coverage disclosure, and package version
ownership shared across delivery targets.
## Requirements
### Requirement: Durable Workbench run journal

The core SHALL persist bounded Workbench process history and checkpoint state
in a versioned workspace-local journal using atomic replacement.

#### Scenario: Completed run survives reload

- **WHEN** a host records and completes a Workbench run
- **AND** the host is restarted
- **THEN** the process remains visible with its terminal state and summary

#### Scenario: Invalid journal is not overwritten

- **WHEN** the persisted journal is corrupt or has an unsupported version
- **THEN** loading fails with an actionable error
- **AND** the existing journal remains unchanged

### Requirement: Interrupted implementation recovery

The Workbench SHALL restore unfinished implementation runs as interrupted and
SHALL NOT silently resume or mark them completed.

#### Scenario: Active implementation is interrupted by reload

- **WHEN** the extension reloads while an implementation checkpoint is active
- **THEN** the process is restored with interrupted state
- **AND** its current workspace delta is finalized for explicit review or
  rollback

### Requirement: Workspace mutation isolation

The Workbench SHALL run at most one mutating process in a workspace at a time
until mutations have independent filesystem isolation.

#### Scenario: Different changes mutate the same workspace

- **WHEN** mutating runs for two different changes are requested
- **THEN** the second run remains queued until the first reaches a terminal
  state
- **AND** read-only runs may execute concurrently

### Requirement: Checkpoint coverage disclosure

A checkpoint SHALL report files and directory classes omitted from rollback
coverage.

#### Scenario: Oversized file is skipped

- **WHEN** a file exceeds the configured per-file checkpoint limit
- **THEN** its relative path is recorded in checkpoint coverage
- **AND** a host can disclose that rollback coverage is partial

### Requirement: Package-level version ownership

Release documentation SHALL treat package versions as authoritative and SHALL
bump only packages whose shipped behavior changes according to SemVer.

#### Scenario: Core and extension gain persistence

- **WHEN** persistent Workbench runs ship in core and VS Code
- **THEN** core and extension receive compatible minor version bumps
- **AND** unchanged server and webui package versions remain unchanged

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

### Requirement: Run recovery fails closed for incompatible persisted formats
The system SHALL reject unsupported journal and checkpoint versions without
moving, rewriting, or deleting the persisted journal.

#### Scenario: Older delivery opens a future journal version
- **WHEN** the persisted journal version is newer than the bundled core supports
- **THEN** recovery fails with an upgrade-required diagnostic
- **AND** the journal remains byte-for-byte unchanged at its original path

#### Scenario: Journal contains a future checkpoint version
- **WHEN** the journal version is supported but a checkpoint version is not
- **THEN** recovery fails with a checkpoint compatibility diagnostic
- **AND** the journal remains byte-for-byte unchanged

#### Scenario: Journal JSON is malformed
- **WHEN** the journal cannot be parsed as JSON
- **THEN** recovery fails with a corruption diagnostic distinct from version compatibility

#### Scenario: Host presents a recovery failure
- **WHEN** core rejects persisted recovery state
- **THEN** the host displays the actionable core diagnostic
- **AND** does not infer compatibility by parsing human-readable error text
