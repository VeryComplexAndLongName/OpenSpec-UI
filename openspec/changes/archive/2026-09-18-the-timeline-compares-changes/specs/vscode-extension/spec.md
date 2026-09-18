## ADDED Requirements

### Requirement: A global command compares every change on a grid of days

The system SHALL offer a Command Palette command, not tied to any single
tree item, that opens a webview comparing every change of the workspace on
a grid whose columns are days — the same screen the standalone shell draws,
with the editor's own colours.

The command SHALL NOT ask which changes to compare. Picking from a list of
every change in the workspace is the work the screen exists to do, and the
editor's answer to "how did this project's changes run" must be the
browser's answer, not a different one.

The webview SHALL be able to ask the extension host for the histories of
the changes it is showing, so its charts rest on the same data the
one-change timeline does, and SHALL state a failed request rather than
leaving the charts blank. A row SHALL open that change's own timeline
panel.

Where reading the workspace fails, the extension SHALL say so and open no
webview.

#### Scenario: Opening the comparison

- **WHEN** the user invokes "Show Change Comparison Timeline"
- **THEN** a webview opens with every active and archived change drawn as a
  bar from proposed to archived, with no selection asked for first

#### Scenario: Opening a change from its row

- **WHEN** the user activates a row in the comparison
- **THEN** that change's own timeline panel opens

#### Scenario: The charts cannot be read

- **WHEN** the webview asks for the histories behind its charts and the
  read fails
- **THEN** the webview says the charts could not be read, and the grid
  stays as it is

#### Scenario: The workspace cannot be read

- **WHEN** reading the workspace's dates throws
- **THEN** the extension shows an error message and does not open a webview

## REMOVED Requirements

### Requirement: A global command compares several changes on a shared timeline

**Reason**: The command asked the user to multi-select from every change in
the workspace, and drew the selection on a logarithmic axis whose positions
no reader could turn back into dates. ADR 0033 decision 4 draws the
comparison as a grid of days over the whole workspace.

**Migration**: The command is described by "A global command compares every
change on a grid of days": it opens directly, over every change, on the
same screen the standalone shell draws.
