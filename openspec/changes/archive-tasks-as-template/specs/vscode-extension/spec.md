## ADDED Requirements

### Requirement: Archive tree offers copying tasks as a template into an active change

The system SHALL provide a context-menu action on archived changes in the
Archive tree view that lets the user pick a non-archived change and insert
the archived change's tasks as a template (checkboxes reset to unchecked)
into that change's `tasks.md`, using the standard text editor so the
insertion is undoable and requires the user's own save.

#### Scenario: User copies tasks from an archived change

- **WHEN** the user right-clicks an archived change in the Archive tree and
  chooses "Copy tasks as template into…", then picks a non-archived change
- **THEN** `tasks.md` for the picked change opens in the editor with the
  template inserted
- **AND** the insertion is a normal, undoable text edit, not a silent file
  write

#### Scenario: No non-archived changes exist

- **WHEN** the user triggers the action but the workspace has no
  non-archived changes to pick as a target
- **THEN** the system reports that there is no valid target instead of
  offering an empty picker
