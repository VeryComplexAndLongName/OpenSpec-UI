## MODIFIED Requirements

### Requirement: Users can edit change markdown artifacts in-app
The system SHALL provide markdown editing for proposal, design, tasks, and spec
files of a selected non-archived change while preventing partial saves and
silent overwrites of newer disk content.

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