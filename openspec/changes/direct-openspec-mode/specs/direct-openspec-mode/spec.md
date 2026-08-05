# direct-openspec-mode Specification

## ADDED Requirements

### Requirement: Extension exposes direct OpenSpec commands only
The system SHALL remove user-facing command palette actions for AI agent
execution (`plan`, `implement`, `review`, `cancel`) and SHALL keep direct
OpenSpec commands and utility actions.

#### Scenario: User opens command palette
- **WHEN** contributed commands are listed
- **THEN** AI agent execution commands are absent
- **AND** direct OpenSpec commands (status/view/show/validate/spec summary)
  remain available

### Requirement: Direct JSON command set is non-interactive
The system SHALL execute status/list/show/validate via OpenSpec JSON commands
without interactive prompts and SHALL render their outputs in the panel.

#### Scenario: User runs direct command from UI panel
- **WHEN** command is one of status/list/show/validate
- **THEN** host resolves it through OpenSpec JSON CLI wrappers
- **AND** UI receives started/stdout/completed events without waiting for agent transport

#### Scenario: User needs a change-scoped command
- **WHEN** user selects status/show/validate
- **THEN** UI requires loading changes via list and selecting a change before run
- **AND** command context uses the selected change path

#### Scenario: User runs status from UI panel
- **WHEN** command is status
- **THEN** UI displays progress/artifact state as status card, not raw text

### Requirement: Standalone server does not require AI runners by default
The standalone server SHALL run with OpenSpec-direct capabilities without
constructing AI runner registries unless explicitly injected for tests.

#### Scenario: Server starts in default configuration
- **WHEN** no custom runner map is provided
- **THEN** server starts successfully
- **AND** OpenSpec overview/status-json endpoints remain available
