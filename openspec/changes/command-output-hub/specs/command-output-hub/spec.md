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

### Requirement: AI panel coalesces fragmented stream chunks
The system SHALL merge adjacent fragmented `stdout`/`stderr` chunks from the
same run before rendering so the user sees readable sentences and step blocks
instead of arbitrary transport-level fragments.

#### Scenario: Stream delivers sentence across many tiny chunks
- **WHEN** one logical response arrives as multiple adjacent `stdout` chunks
- **THEN** AI panel combines them into a single readable event block
- **AND** users can read the final thought without manually stitching words

### Requirement: AI panel provides run-level analysis summary
The system SHALL show a structured run summary above chronology, including
detected step actions, warning count, and terminal result state.

#### Scenario: Copilot-style step stream with terminal completion
- **WHEN** stdout contains step markers (`●`, `│`, `└`) and run reaches terminal state
- **THEN** AI panel shows a "Run analysis" block with parsed steps
- **AND** terminal status is shown as completed/failed/cancelled with summary if present

### Requirement: AI panel supports status command directly
The system SHALL provide `status` in the same command picker used for
`plan`/`implement`/`review`.

#### Scenario: User selects status in AI panel
- **WHEN** user selects `status` and runs the command
- **THEN** transport receives command `{ kind: "status", ... }`
- **AND** results are rendered through the same structured event stream

### Requirement: Status command uses JSON-native OpenSpec output
The system SHALL execute `status` via `openspec status --json` wherever host
runtime allows direct OpenSpec CLI access, and SHALL render parsed status data
with dedicated UI elements instead of plain textual dumps.

#### Scenario: User runs status from AI panel
- **WHEN** user executes `status` in standalone or extension-host AI panel
- **THEN** host resolves status through OpenSpec JSON wrapper
- **AND** UI shows progress/artifact information as structured status card

### Requirement: Extension provides OpenSpec utility command entry points
The extension SHALL provide command palette actions for:
- launching `openspec view` in an integrated terminal
- opening parsed change details from `showChange(...)`
- opening parsed strict validation summary from `validateChange(...)`
- opening parsed `openspec view` summary alongside terminal launch

#### Scenario: User runs OpenSpec validation action
- **WHEN** user picks a change from QuickPick in validation action
- **THEN** extension executes strict validation through core wrapper
- **AND** opens a readable Markdown summary document instead of raw CLI text

#### Scenario: User runs openspec view from command palette
- **WHEN** user executes `openspec-ui.openspecView`
- **THEN** extension starts interactive `openspec view` in integrated terminal
- **AND** opens a parsed markdown overview of changes/specs as a visual companion

### Requirement: Shell inputs persist across page reloads
The system SHALL persist `Workspace root (cwd)` and `Change directory` field
values across page reloads in both standalone and extension webview shells.

#### Scenario: User refreshes UI after editing shell fields
- **WHEN** user enters values for `Workspace root (cwd)` and `Change directory`
	and then reloads the page/webview
- **THEN** the same values are restored automatically
- **AND** user does not need to re-enter them before running commands

### Requirement: Standalone UI provides parsed OpenSpec view summary
The standalone shell SHALL provide a visual OpenSpec overview panel that
renders change/spec metadata as readable tables instead of raw terminal text.

#### Scenario: User requests OpenSpec overview in standalone UI
- **WHEN** user clicks "Load summary" in the OpenSpec view summary panel
- **THEN** UI requests parsed overview data from server REST endpoint
- **AND** renders counts and tabular change/spec sections
- **AND** shows clear error text when overview fetch fails
