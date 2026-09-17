## MODIFIED Requirements

### Requirement: The Pipeline is shown in the editor

The extension SHALL offer a command that opens the Pipeline in an editor
panel, rendered by the same shared component the standalone shell uses.

The panel SHALL get its readings from direct calls to the core package
over the message bridge, unless the optional local server is already running,
in which case it MAY embed the shell's Pipeline screen and let that server's
process take the readings. The panel SHALL NOT start a local server to get
them. Where it embeds the shell, it SHALL frame the shell again when the
editor's theme changes between light and dark.

The readiness payload SHALL be assembled by the same core function that
the standalone server uses, so that hints are on or off for the same
configuration in both hosts.

A window SHALL have at most one such panel.

The extension's views SHALL NOT keep the panel's readings from answering
within the bridge's wait: a view SHALL read only the changes it shows, and
no view SHALL read a workspace once for every change it names.

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

#### Scenario: The editor's theme changes while the Pipeline is open

- **WHEN** the panel embeds the shell and the editor's theme changes from
  dark to light
- **THEN** the embedded Pipeline is drawn light

#### Scenario: A repository with hundreds of archived changes

- **WHEN** the command is run with the OpenSpec view showing, in a
  repository with hundreds of archived changes, several working directories
  and a process history naming dozens of changes
- **THEN** the panel draws its cards, and no reading reports that the host
  did not reply in time
