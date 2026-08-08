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
