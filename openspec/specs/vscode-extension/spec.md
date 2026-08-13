# vscode-extension Specification

## Purpose
VS Code extension as a thin host adapter over `execution-core`, using native
VS Code UI capabilities first and Webview only where native APIs are
insufficient.
## Requirements
### Requirement: Primary mode is direct-core integration without local server
The system SHALL run `vscode-extension` in primary mode without launching an
internal HTTP server. The extension host SHALL call `execution-core` directly,
and Webview communication SHALL use an in-process message bridge.

#### Scenario: User runs plan command in default extension configuration
- **WHEN** user executes `openspec.plan` in Command Palette
- **THEN** extension performs command through direct `execution-core` import
- **AND** no localhost HTTP listener is required for this path

### Requirement: Localhost server mode is optional and opt-in
The system MAY offer an optional mode where extension launches local
`server` package and Webview communicates over localhost.
This mode SHALL be disabled by default and SHALL be enabled only by explicit
user configuration.

#### Scenario: User enables localhost mode in extension settings
- **WHEN** user turns on `openspec.transport.localServer.enabled`
- **THEN** extension launches/reuses local server with dynamic port selection
- **AND** Webview points to that localhost endpoint
- **AND** disabling the setting returns to default message-bridge mode

### Requirement: Native diff UI is used for review
The system SHALL use VS Code native diff editor for file comparison and SHALL
NOT render custom diff UI inside Webview for extension mode.

#### Scenario: User reviews generated changes
- **WHEN** user triggers "Review diff" action
- **THEN** extension opens `vscode.diff` with before/after document URIs
- **AND** user can stage/discard through native VS Code and Git integrations
