# openspec-workbench Specification

## Purpose
TBD - created by archiving change openspec-workbench. Update Purpose after archive.
## Requirements
### Requirement: Workbench exposes the complete OpenSpec workspace

The system SHALL provide hierarchical navigation to configuration, active and
archived changes, canonical specs, and proposal, design, tasks, and delta spec
artifacts without requiring users to locate files manually.

#### Scenario: User expands an active change

- **WHEN** the user expands a change in the Workbench
- **THEN** proposal, design, tasks, and delta specs are shown
- **AND** selecting an artifact opens it in a native VS Code editor

#### Scenario: A collection does not exist

- **WHEN** archive or canonical specs have not been created
- **THEN** the view explains why it is empty
- **AND** offers an applicable lifecycle or documentation action

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

The system SHALL display queued and active operations, progress, result summary,
terminal state, history, and available controls for every Workbench process.

#### Scenario: Independent changes run concurrently

- **WHEN** mutating operations target different changes
- **THEN** the scheduler may execute them concurrently
- **AND** the dashboard displays each process independently

#### Scenario: Conflicting mutation is requested

- **WHEN** a mutating process already owns the target change lock
- **THEN** the new process is queued or rejected with an actionable reason
- **AND** it does not mutate files concurrently

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

The system SHALL capture a bounded checkpoint before an AI-assisted mutation and
SHALL restore only the run-owned delta when rollback is confirmed and conflict
checks pass.

#### Scenario: User rolls back an uncontested run

- **WHEN** affected files still match their post-run fingerprints
- **AND** the user reviews and confirms the affected file list
- **THEN** files are restored to their pre-run state
- **AND** the process is marked rolled back

#### Scenario: A file changed after the run

- **WHEN** an affected file no longer matches its post-run fingerprint
- **THEN** rollback refuses to overwrite it
- **AND** identifies the conflicting file for manual resolution

