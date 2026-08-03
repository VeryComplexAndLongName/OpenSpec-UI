# command-output-hub Specification

## Purpose
Improve command usability in UI by replacing raw line-oriented output with
structured rendering and by exposing high-value OpenSpec utility actions in the
extension command menu.

## ADDED Requirements

### Requirement: AI panel renders structured command output
The system SHALL render event payloads using structured UI blocks when output
matches known shapes (JSON, checklist, key-value lines, bullet lists), and
SHALL fall back to plain text rendering for unrecognized output.

#### Scenario: Agent emits checklist-like stdout
- **WHEN** a `stdout` event contains checkbox lines (`- [x] ...` / `- [ ] ...`)
- **THEN** AI panel displays checklist items as structured task rows
- **AND** the same event remains visible in the stream chronology

### Requirement: AI panel supports status command directly
The system SHALL provide `status` in the same command picker used for
`plan`/`implement`/`review`.

#### Scenario: User selects status in AI panel
- **WHEN** user selects `status` and runs the command
- **THEN** transport receives command `{ kind: "status", ... }`
- **AND** results are rendered through the same structured event stream

### Requirement: Extension provides OpenSpec utility command entry points
The extension SHALL provide command palette actions for:
- launching `openspec view` in an integrated terminal
- opening parsed change details from `showChange(...)`
- opening parsed strict validation summary from `validateChange(...)`

#### Scenario: User runs OpenSpec validation action
- **WHEN** user picks a change from QuickPick in validation action
- **THEN** extension executes strict validation through core wrapper
- **AND** opens a readable Markdown summary document instead of raw CLI text

### Requirement: Shell inputs persist across page reloads
The system SHALL persist `Workspace root (cwd)` and `Change directory` field
values across page reloads in both standalone and extension webview shells.

#### Scenario: User refreshes UI after editing shell fields
- **WHEN** user enters values for `Workspace root (cwd)` and `Change directory`
	and then reloads the page/webview
- **THEN** the same values are restored automatically
- **AND** user does not need to re-enter them before running commands
