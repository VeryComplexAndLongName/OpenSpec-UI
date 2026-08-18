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

### Requirement: Standalone shell can report which agents are detected

The standalone delivery SHALL expose an endpoint that reports, per
registered agent id, a best-effort presence signal for that agent's
underlying CLI executable or HTTP endpoint. The agent picker SHALL
annotate each option with the result without removing or disabling any
option, regardless of detection outcome.

#### Scenario: User loads the AI panel and agents are detected

- **WHEN** the AI panel mounts in the standalone browser tab
- **THEN** the client requests detection results and annotates each agent
  option in the picker with "detected" or "not detected", and every
  option remains selectable either way

#### Scenario: User refreshes detection

- **WHEN** the user clicks "Refresh agents"
- **THEN** the client requests detection again and updates the
  annotations, without altering the currently selected agent

#### Scenario: Detection endpoint is unreachable or errors

- **WHEN** the detection request fails
- **THEN** the picker falls back to showing no annotation (equivalent to
  "unknown"), not an error state that blocks selecting or running an
  agent

### Requirement: Standalone shell can invoke a selectable AI agent

The standalone delivery SHALL execute `plan`, `implement`, and `review`
commands through a CLI agent runner, resolved from the same registry the
UI presents for selection. The system SHALL default to
`DEFAULT_AGENT_ID` when the user has not explicitly picked one.

#### Scenario: User runs implement with the default agent

- **WHEN** the user selects a change, leaves the agent picker at its
  default, and runs "implement"
- **THEN** the command executes through the default agent's runner and
  streams events the same way `status`/`list`/`show`/`validate` already do

#### Scenario: User runs implement with a non-default agent

- **WHEN** the user picks a non-default entry from the agent picker and
  runs "implement"
- **THEN** the command executes through that agent's runner instead

#### Scenario: Selected agent's CLI tool is not installed

- **WHEN** the selected agent's underlying CLI executable is not found on
  the machine
- **THEN** the run reports a `failed` event with a clear reason, the same
  way any other spawn failure already does — no silent hang

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

### Requirement: Standalone shell displays package versions

The server SHALL expose `GET /api/versions`, token-gated the same as
every other `/api/` route, returning the `@openspec-ui/core` and
`@openspec-ui/server` package versions read from each package's own
`package.json`. The standalone browser shell, when booted without the VS
Code local-server embed signal (see "Standalone shell restricts tabs
when embedded as the VS Code local-server view"), SHALL display a
footer showing the `core`, `server`, and `webui` versions. When booted
under the VS Code local-server embed signal, the shell SHALL NOT render
this footer.

#### Scenario: Plain standalone browser tab shows versions

- **WHEN** a user opens the server's launch URL directly in a browser (no
  VS Code embed signal present)
- **THEN** a footer showing `core`, `server`, and `webui` version numbers
  is rendered

#### Scenario: VS Code local-server embed shows no version footer

- **WHEN** the shell is booted under the VS Code local-server embed
  signal
- **THEN** no version footer is rendered

