# change-editor-workbench Specification

## ADDED Requirements

### Requirement: Users can create a change from the standalone UI
The system SHALL provide a UI action to create a new OpenSpec change directory
without leaving the standalone shell.

#### Scenario: User creates a new change
- **WHEN** user enters a change id and submits create action
- **THEN** server creates the change via OpenSpec CLI
- **AND** UI refreshes available changes

### Requirement: Users can edit change markdown artifacts in-app
The system SHALL provide markdown editing for proposal/design/tasks/spec files of
a selected change while the change is not archived.

#### Scenario: User loads a change in editor
- **WHEN** user selects a change and loads editor
- **THEN** UI shows current markdown content for editable artifacts

#### Scenario: User saves edits
- **WHEN** user modifies markdown and clicks save
- **THEN** server writes updated markdown files to the change directory
- **AND** UI reports successful save

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
