## ADDED Requirements

### Requirement: Users can copy an archived change's tasks as a template into a loaded change

The system SHALL let the user select an archived change and retrieve its
`tasks.md` content as a template, with all checkbox items reset to
unchecked (`- [ ]`) regardless of their state in the archive. The system
SHALL insert this template into the tasks content of the currently loaded,
non-archived change in the editor without writing to disk; the inserted
content SHALL only persist if the user explicitly saves through the
existing conflict-checked save flow.

#### Scenario: User inserts an archived change's tasks as a template

- **WHEN** the user has a non-archived change loaded in the Change Editor,
  selects an archived change, and requests its tasks as a template
- **THEN** the archived change's task structure is inserted into the Tasks
  tab content with every checkbox reset to unchecked
- **AND** no file on disk is modified until the user saves

#### Scenario: Requested source is not an archived change

- **WHEN** the requested source change name does not correspond to an
  entry under the archive
- **THEN** the system rejects the request and does not read any file
  outside the archived change directories

#### Scenario: No change is loaded in the editor

- **WHEN** the user requests a tasks template before loading a target
  change
- **THEN** the system does not offer the insert action
