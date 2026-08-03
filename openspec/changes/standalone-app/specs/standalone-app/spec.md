# standalone-app Specification

## Purpose
Standalone web tool (thin REST/WS server over `execution-core` + browser build
of `webui`) for users without VS Code.

## ADDED Requirements

### Requirement: Server contains no business logic
The system SHALL implement `server` strictly as serialization of
`execution-core` command/event protocol over HTTP/WebSocket. The system SHALL
NOT duplicate agent-run logic, security checks, or change-state derivation in
`server`; those operations SHALL be delegated to `execution-core`.

#### Scenario: Security model changes in execution-core
- **WHEN** allowlist/cwd-sandbox behavior changes in `execution-core`
- **THEN** `server` behavior changes automatically without `server` logic
  changes

### Requirement: Server is localhost-only by default
The system SHALL accept connections from localhost only by default. The system
SHALL NOT accept remote-interface connections unless user configuration is
intentionally changed.

#### Scenario: Server started with default configuration
- **WHEN** user launches `server` with defaults
- **THEN** server is not reachable from other machines on the network