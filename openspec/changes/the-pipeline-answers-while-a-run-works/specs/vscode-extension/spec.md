## MODIFIED Requirements

### Requirement: Optional local-server embed signals its context to the standalone shell

When the optional local-server Webview mode is active, the extension SHALL
mark the iframe URL it builds for the standalone shell with a signal
identifying it as the VS Code local-server embed, distinct from a plain
standalone browser session. The extension SHALL NOT rely on the standalone
shell rendering its full section set inside this embed; native VS Code UI
(diff editor, tree views, native file editing) remains the source of truth
for the areas the embed does not show.

The embed SHALL carry a closed set of the shell's screens, and the URL SHALL
say which of them the embedding panel wants. A screen the set does not carry
SHALL NOT be shown in the embed, whatever the URL asks for.

#### Scenario: Local-server mode webview panel is created

- **WHEN** `AiPanel` builds the iframe HTML for the optional local-server
  mode
- **THEN** the iframe `src` includes the embed signal identifying it as the
  VS Code local-server embed

#### Scenario: Direct-core message-bridge mode is unaffected

- **WHEN** the extension runs in its default message-bridge mode (no local
  server)
- **THEN** no embed signal is relevant, since this mode does not load the
  standalone shell at all

#### Scenario: A panel asks for its own screen

- **WHEN** a panel embeds the shell and its URL names a screen the embed
  carries
- **THEN** the embedded shell opens on that screen

#### Scenario: A URL asks for a screen the embed does not carry

- **WHEN** the URL names a screen outside the embed's set
- **THEN** the embedded shell opens on the first screen it does carry, and
  shows no other

### Requirement: The Pipeline is shown in the editor

The extension SHALL offer a command that opens the Pipeline in an editor
panel, rendered by the same shared component the standalone shell uses.

The panel SHALL get its readings from direct calls to the core package
over the message bridge, unless the optional local server is already running,
in which case it MAY embed the shell's Pipeline screen and let that server's
process take the readings. The panel SHALL NOT start a local server to get
them.

The readiness payload SHALL be assembled by the same core function that
the standalone server uses, so that hints are on or off for the same
configuration in both hosts.

A window SHALL have at most one such panel.

#### Scenario: Opening the Pipeline

- **WHEN** the command is run in a workspace with active changes
- **THEN** a panel shows the Pipeline, read from that workspace, and no
  local server is started

#### Scenario: Opening it again

- **WHEN** the command is run while the panel is already open
- **THEN** the existing panel is shown, and no second panel is opened

#### Scenario: Hints turned off

- **WHEN** the workspace configuration turns hints off
- **THEN** the editor's Pipeline shows no hints, as the standalone shell
  shows none

#### Scenario: A run is working in this editor

- **WHEN** the optional local server is running and a chain is running in the
  extension host
- **THEN** the panel's cards are drawn from readings the server's process
  took, and the panel reports no unanswered reading

#### Scenario: The optional server is off

- **WHEN** the optional local server is not running
- **THEN** the panel reads over the message bridge as before, and starts no
  server

### Requirement: A change opened from the editor's Pipeline is revealed where it is worked on

Opening a change from the editor's Pipeline SHALL reveal that change in
the Changes tree and open its proposal. That SHALL hold whether the panel
reads over the message bridge or embeds the shell.

The panel SHALL send only the change's name. The host SHALL open nothing
for a name that is not an active change of its own workspace, and SHALL
say so.

Where the panel embeds the shell, the host SHALL accept the name only from
the embedded page's own origin, and SHALL ignore a message from any other.

#### Scenario: An active change

- **WHEN** a change's card is opened
- **THEN** the change is revealed in the Changes tree and its proposal
  opens

#### Scenario: A name that is no longer active

- **WHEN** the name sent is not an active change of the workspace
- **THEN** nothing opens, and the editor says the change is not active

#### Scenario: A message from another origin

- **WHEN** a message naming a change arrives from an origin other than the
  embedded page's
- **THEN** nothing opens
