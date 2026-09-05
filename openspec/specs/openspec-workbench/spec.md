# openspec-workbench Specification

## Purpose

Define integrated OpenSpec workspace navigation, lifecycle control, native VS
Code AI workflows, process visibility, and conflict-safe rollback.
## Requirements
### Requirement: Workbench exposes the complete OpenSpec workspace

The system SHALL provide hierarchical navigation to configuration, active and
archived changes, canonical specs, and proposal, design, tasks, and delta spec
artifacts without requiring users to locate files manually. When the Processes
dashboard opens from VS Code, it SHALL initialize its workspace and change
paths from the current host context and SHALL use VS Code semantic theme colors.

#### Scenario: User expands an active change

- **WHEN** the user expands a change in the Workbench
- **THEN** proposal, design, tasks, and delta specs are shown
- **AND** selecting an artifact opens it in a native VS Code editor

#### Scenario: A collection does not exist

- **WHEN** archive or canonical specs have not been created
- **THEN** the view explains why it is empty
- **AND** offers an applicable lifecycle or documentation action

#### Scenario: User opens the Processes dashboard from Changes

- **WHEN** the user invokes Open Process Dashboard from the Changes view title
- **THEN** Workspace root contains the active VS Code workspace path
- **AND** Change directory contains that workspace's `openspec/changes` path

#### Scenario: Existing dashboard receives new context

- **WHEN** the dashboard is already open and is revealed for another change
- **THEN** its workspace and change-directory fields update to the supplied host
  context
- **AND** stale local-storage values do not override the host context

#### Scenario: VS Code color theme changes

- **WHEN** VS Code renders the dashboard in a light, dark, high-contrast, or
  custom color theme
- **THEN** dashboard surfaces, text, controls, borders, and focus indicators use
  VS Code semantic theme variables
- **AND** the standalone browser palette is unchanged

### Requirement: Users control the complete change lifecycle

The system SHALL support create, edit, validate, archive, unarchive, and guarded
delete workflows while keeping OpenSpec and repository files as the source of
truth.

#### Scenario: User archives a valid completed change

- **WHEN** the user previews and confirms archive
- **THEN** core invokes the deterministic OpenSpec archive operation
- **AND** active, archived, and canonical spec views refresh

#### Scenario: User requests a destructive operation

- **WHEN** the user requests delete, unarchive, or rollback
- **THEN** the Workbench shows the affected paths or diff
- **AND** no mutation occurs without explicit confirmation

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

### Requirement: AI workflows use explicit native VS Code Chat integration

The system SHALL register an OpenSpec Chat participant for plan, implement, and
review workflows, while direct OpenSpec commands remain available without AI.

#### Scenario: User starts implementation from Chat

- **WHEN** the user explicitly invokes the OpenSpec participant for a change
- **THEN** VS Code controls model selection and authorization
- **AND** the Workbench provides bounded repository context and typed actions
- **AND** repository content cannot grant additional tool or path permissions

#### Scenario: No language model is available

- **WHEN** the user invokes an AI workflow without an available model
- **THEN** deterministic lifecycle commands continue to work
- **AND** the Workbench presents a clear fallback instruction

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

### Requirement: A change's task record states what has actually been done

A change's task record SHALL reflect the state of the repository. Work
that has shipped SHALL be recorded as done, and work that has not SHALL
NOT be.

A verification item SHALL be recorded as done only after it has been
carried out, never in the same act as the work it verifies.

Where an item can only be carried out by a person, it SHALL remain open
until that person has carried it out, and SHALL NOT be inferred from
related evidence.

#### Scenario: Work has shipped

- **WHEN** a change's implementation is present in the default branch
- **THEN** its task record shows that work as done

#### Scenario: A verification item has not been run

- **WHEN** a verification item's checks have not been carried out
- **THEN** it remains open, whatever the state of the work it verifies

#### Scenario: An item only a person can carry out

- **WHEN** an item is marked as requiring a person
- **THEN** it stays open until that person reports it done, and passing
  automated checks do not close it

#### Scenario: Partial evidence for a verification item

- **WHEN** part of what an item claims has been observed and part has not
- **THEN** the item stays open, rather than being closed on the observed
  part

