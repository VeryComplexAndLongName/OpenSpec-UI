# change-editor-workbench Specification

## Purpose
TBD - created by archiving change change-editor-workbench. Update Purpose after archive.
## Requirements
### Requirement: Users can create a change from the standalone UI
The system SHALL provide a UI action to create a new OpenSpec change directory
without leaving the standalone shell.

#### Scenario: User creates a new change
- **WHEN** user enters a change id and submits create action
- **THEN** server creates the change via OpenSpec CLI
- **AND** UI refreshes available changes

### Requirement: Users can edit change markdown artifacts in-app
The system SHALL provide markdown editing for proposal, design, tasks, and spec
files of a selected non-archived change while preventing partial saves and
silent overwrites of newer disk content.

#### Scenario: User loads a change in editor
- **WHEN** user selects a change and loads editor
- **THEN** UI shows current markdown content for editable artifacts

#### Scenario: User saves edits
- **WHEN** user modifies markdown and clicks save
- **THEN** server writes updated markdown files to the change directory
- **AND** UI reports successful save

#### Scenario: User saves edits based on the loaded revision
- **WHEN** the user saves all edited artifacts and their loaded revision still matches disk state
- **THEN** the system replaces the complete editable artifact set
- **AND** returns the revision of the saved document

#### Scenario: An artifact changed outside the editor
- **WHEN** the user saves with a revision that no longer matches disk state
- **THEN** the system rejects the save as a conflict before modifying any artifact
- **AND** the UI preserves the user's unsaved text

#### Scenario: File replacement fails during save
- **WHEN** the filesystem rejects a replacement after the save transaction starts
- **THEN** the system restores the artifact set that existed before the save
- **AND** reports that the save failed

### Requirement: Markdown preview is available during editing
The system SHALL show markdown preview for edited content to reduce authoring
errors.

#### Scenario: User toggles between raw markdown and preview
- **WHEN** user edits markdown text
- **THEN** preview reflects updated content in the same editor workflow

### Requirement: Workspace initialization is guided when OpenSpec artifacts are missing
The system SHALL detect missing OpenSpec initialization artifacts for the selected
workspace and provide an in-app initialization flow with explicit AI tool
selection.

#### Scenario: User selects a non-initialized workspace
- **WHEN** workspace root is set and OpenSpec artifacts are not present
- **THEN** UI shows initialization controls
- **AND** initialize action remains available until artifacts appear

#### Scenario: User initializes with selected AI tools
- **WHEN** user selects supported AI tools and starts initialization
- **THEN** server runs `openspec init --tools ...`
- **AND** UI refreshes workspace state
- **AND** initialize action is hidden after artifacts exist

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

