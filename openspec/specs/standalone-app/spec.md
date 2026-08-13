# standalone-app Specification

## Purpose
Standalone web tool (thin REST/WS server over `execution-core` + browser build
of `webui`) for users without VS Code.
## Requirements
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

The system SHALL bind to localhost by default and SHALL authenticate every
REST API request and WebSocket connection with an ephemeral per-server token.
The system SHALL reject browser API requests whose Origin does not identify
the active server. The system SHALL NOT accept remote-interface connections
unless user configuration is intentionally changed.

#### Scenario: Server started with default configuration

- **WHEN** user launches `server` with defaults
- **THEN** server is not reachable from other machines on the network

#### Scenario: Browser uses the authenticated launch URL

- **WHEN** the standalone browser obtains the token from the launch URL fragment
- **THEN** REST and WebSocket requests are authenticated without persisting the token

#### Scenario: Untrusted website targets the local server

- **WHEN** a request has a missing token or an Origin for another site
- **THEN** the server rejects it before executing an OpenSpec operation

### Requirement: Server authorizes requested workspaces

The system SHALL authorize every client-provided working directory against the
server workspace policy before reading files, writing files, or invoking
OpenSpec. External working directories SHALL remain disabled unless the server
was started with explicit external-cwd opt-in.

#### Scenario: Default server receives an external cwd

- **WHEN** an API request targets a directory outside the configured workspace
- **THEN** the server rejects the request before any filesystem or process operation

### Requirement: Server bounds untrusted transport input

The system SHALL reject REST and WebSocket messages larger than its configured
payload limit before parsing or executing them.

#### Scenario: Oversized REST body

- **WHEN** a request body exceeds the configured limit
- **THEN** the server responds with payload-too-large and performs no operation

### Requirement: Standalone exposes persistent process recovery

The standalone delivery SHALL display persisted process history and SHALL let
the user explicitly inspect checkpoint delta and coverage, request rollback,
and clean retained history.

#### Scenario: Interrupted process is opened in standalone

- **WHEN** the user loads Processes for the workspace
- **THEN** the UI identifies the process as interrupted and displays its recovery details

#### Scenario: User confirms rollback

- **WHEN** the checkpoint remains conflict-free
- **THEN** standalone restores the checkpoint through core and displays the rolled-back state
