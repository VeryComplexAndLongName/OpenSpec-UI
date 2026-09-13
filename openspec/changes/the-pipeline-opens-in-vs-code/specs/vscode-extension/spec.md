## ADDED Requirements

### Requirement: The Pipeline is shown in the editor

The extension SHALL offer a command that opens the Pipeline in an editor
panel, rendered by the same shared component the standalone shell uses.

The panel SHALL get its readings from direct calls to the core package
over the message bridge. It SHALL NOT start a local server to get them.

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

### Requirement: The editor's Pipeline re-reads when what it reads changes

While the panel is visible, a change to the workspace's active changes
SHALL cause the panel to read again. A change to the runs' status records
SHALL cause the panel to read the records again, without running git.

A slow re-read SHALL cover what changes without a file event.

Nothing SHALL be watched or re-read while the panel is hidden or closed.

#### Scenario: A change is added

- **WHEN** a change directory is created while the panel is visible
- **THEN** the panel shows the change without waiting for the slow
  re-read

#### Scenario: A run reports

- **WHEN** a run's status record is written while the panel is visible
- **THEN** the records are read again, and no git command runs for that
  reading

#### Scenario: The panel is hidden

- **WHEN** the panel is hidden
- **THEN** nothing is watched and nothing is read until it is shown again

### Requirement: A change opened from the editor's Pipeline is revealed where it is worked on

Opening a change from the editor's Pipeline SHALL reveal that change in
the Changes tree and open its proposal.

The panel SHALL send only the change's name. The host SHALL open nothing
for a name that is not an active change of its own workspace, and SHALL
say so.

#### Scenario: An active change

- **WHEN** a change's card is opened
- **THEN** the change is revealed in the Changes tree and its proposal
  opens

#### Scenario: A name that is no longer active

- **WHEN** the name sent is not an active change of the workspace
- **THEN** nothing opens, and the editor says the change is not active
