## ADDED Requirements

### Requirement: Standalone shell exposes its sections as tabs

The standalone browser shell SHALL present "Run a Command", "Processes and
Recovery", "Diff Preview", "OpenSpec view summary", and "Change Editor" as
separate tabs rather than a single scrolling page. Only one tab's content
SHALL be visible at a time; switching tabs SHALL NOT discard in-progress
state in the other tabs (e.g. an unsaved Change Editor draft, an in-flight
Run a Command execution).

#### Scenario: User switches from Change Editor to Run a Command

- **WHEN** the user has unsaved edits in the Change Editor tab and switches
  to the Run a Command tab
- **THEN** the Change Editor tab retains the unsaved edits when the user
  switches back

### Requirement: Standalone shell restricts tabs when embedded as the VS Code local-server view

The standalone shell SHALL detect whether it was booted as the VS Code
extension's optional local-server embed (see `vscode-extension` capability,
"Optional local-server embed signals its context to the standalone shell").
When booted under that signal, the shell SHALL show only the "Run a
Command" tab and SHALL NOT render the "Processes and Recovery", "Diff
Preview", "OpenSpec view summary", or "Change Editor" tabs. When booted
without that signal (plain standalone browser), the shell SHALL show all
five tabs.

#### Scenario: Plain standalone browser tab

- **WHEN** a user opens the server's launch URL directly in a browser (no
  VS Code embed signal present)
- **THEN** all five tabs are shown

#### Scenario: VS Code local-server embed

- **WHEN** the shell is loaded inside VS Code's optional local-server
  iframe and the embed signal is present
- **THEN** only the "Run a Command" tab is shown
