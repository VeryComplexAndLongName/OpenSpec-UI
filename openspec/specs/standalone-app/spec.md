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

### Requirement: A Timeline tab shows a change's tasks positioned by completion date

The system SHALL offer a Timeline tab where the user selects any active
or archived change and sees its proposal/design/spec content followed
by its tasks, positioned by best-effort completion date (oldest first),
with pending or undated tasks shown distinctly rather than omitted.

#### Scenario: User selects an active change

- **WHEN** the user selects an active change in the Timeline tab and
  loads it
- **THEN** the tab shows that change's proposal/design/spec content and
  its tasks ordered oldest-completed-first

#### Scenario: User selects an archived change

- **WHEN** the user selects an archived change in the Timeline tab and
  loads it
- **THEN** the tab shows the same content, including the change's
  archived date

#### Scenario: A task has no determinable completion date

- **WHEN** a task is still pending, or its completion date cannot be
  determined
- **THEN** it is shown without a date rather than omitted or given a
  misleading date

### Requirement: The Timeline tab offers a compare-changes mode with a date-range picker

The system SHALL offer, within the existing Timeline tab, a mode that
lets the user pick a date range and select multiple active and/or
archived changes, then shows them as parallel lanes on a shared,
log-scaled time axis.

#### Scenario: User picks a date range and multiple changes

- **WHEN** the user selects a start date, an end date, and multiple
  changes, then loads the comparison
- **THEN** the tab shows one lane per selected change within that range

#### Scenario: User has not selected a range or any changes

- **WHEN** the user attempts to load a comparison without a complete
  date range or without selecting any change
- **THEN** the system reports what is missing rather than loading an
  empty or partial comparison

### Requirement: The Timeline tab's staleness threshold is user-configurable

The system SHALL let the user set the stale-pending-task threshold (in
days) in the standalone Timeline tab, defaulting to 14 days, and apply
it when rendering a change's timeline.

#### Scenario: User changes the threshold

- **WHEN** the user sets a different stale-after value and loads (or
  reloads) a change's timeline
- **THEN** pending tasks are flagged stale according to the new value

### Requirement: The Timeline tab offers a downloadable sprint report

The system SHALL offer, within the Timeline tab, a mode where the user
picks a date range and multiple active and/or archived changes, then
downloads a generated PDF sprint report as a browser file download.

#### Scenario: User generates a sprint report

- **WHEN** the user selects a date range and one or more changes in the
  Sprint report mode and starts the download
- **THEN** a PDF file download begins, named after the selected range

#### Scenario: User has not selected a range or any changes

- **WHEN** the user attempts to generate a report without a complete
  date range or without selecting any change
- **THEN** the system reports what is missing rather than attempting
  to generate an empty or partial report

### Requirement: OpenSpec view summary lists are searchable by name or status

The standalone "OpenSpec view summary" tab SHALL render its active
changes as a searchable list (matching by name or by status label),
replacing a static, non-interactive table, and SHALL additionally render
an Archive section, also searchable, listing archived changes (not
previously shown in this tab). Archived changes SHALL display real
task-completion progress and a last-modified date, sourced from
`execution-core`, rather than only a name.

#### Scenario: User filters active changes by name

- **WHEN** the user types part of a change's name into the Changes
  section's search box
- **THEN** only active changes whose name matches remain visible

#### Scenario: User filters active changes by status

- **WHEN** the user types a status word (e.g. "progress") into the
  Changes section's search box
- **THEN** only active changes whose displayed status label matches
  remain visible

#### Scenario: User filters archived changes

- **WHEN** the user types into the Archive section's search box
- **THEN** only archived changes matching by name or status label remain
  visible, sorted by last-modified date

#### Scenario: Archived changes show real progress

- **WHEN** the Overview tab loads a workspace with archived changes
- **THEN** each archived change displays its actual completed/total task
  count and a last-modified date, not just its name

