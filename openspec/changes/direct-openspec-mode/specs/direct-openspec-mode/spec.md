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

### Requirement: Status command is JSON-native
The system SHALL execute status via `openspec status --json` and SHALL render
its result using structured UI elements.

#### Scenario: User runs status from UI panel
- **WHEN** command is executed
- **THEN** host resolves status with OpenSpec JSON
- **AND** UI displays progress/artifact state as status card, not raw text

### Requirement: Standalone server does not require AI runners by default
The standalone server SHALL run with OpenSpec-direct capabilities without
constructing AI runner registries unless explicitly injected for tests.

#### Scenario: Server starts in default configuration
- **WHEN** no custom runner map is provided
- **THEN** server starts successfully
- **AND** OpenSpec overview/status-json endpoints remain available
