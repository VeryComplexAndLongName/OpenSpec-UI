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

### Requirement: Message-bridge Webview annotates the agent picker with detection results

The message-bridge Webview mode SHALL compute agent presence via a direct
core import in the extension host and deliver the result to the Webview
as part of its existing side-channel `context` message, without adding a
new command/event protocol message. Detection SHALL run without delaying
the AI panel becoming visible or usable.

#### Scenario: Panel opens before detection finishes

- **WHEN** the user opens the AI panel
- **THEN** the panel is revealed and usable immediately with `cwd`/
  `changeDir` context as before, and detection results are applied to the
  picker asynchronously once available, without blocking or reloading the
  panel

#### Scenario: Panel is revealed again

- **WHEN** the user re-triggers a command that reveals an already-open AI
  panel
- **THEN** detection runs again and the picker's annotations refresh,
  without a separate manual refresh action needed in this host

#### Scenario: Optional local-server mode

- **WHEN** `openspec.transport.localServer.enabled` is on and the
  embedded standalone shell is used instead of the message bridge
- **THEN** it uses the standalone REST detection endpoint like plain
  standalone, since it is the same browser bundle

### Requirement: Message-bridge Webview resolves a real agent runner

The default message-bridge Webview mode SHALL resolve `plan`/`implement`/
`review` commands to a real agent runner built from the same
`buildDefaultAgentRunners` registry the standalone delivery uses, instead
of always reporting agent execution as disabled. This is additive to, and
does not replace, the existing native Chat/Agent path
(`openspec-ui.startImplementation`, the `openspec` Chat Participant).

#### Scenario: User runs implement through the AI panel in VS Code

- **WHEN** the user opens the AI panel (message-bridge mode), selects a
  change and an agent, and runs "implement"
- **THEN** the extension host resolves and runs that agent's runner
  directly, the same way the standalone delivery does

#### Scenario: Optional local-server mode also resolves agents

- **WHEN** `openspec.transport.localServer.enabled` is on and the embedded
  standalone shell runs "implement"
- **THEN** the local server it talks to also resolves a real runner,
  consistent with plain standalone

### Requirement: Archive tree offers copying tasks as a template into an active change

The system SHALL provide a context-menu action on archived changes in the
Archive tree view that lets the user pick a non-archived change and insert
the archived change's tasks as a template (checkboxes reset to unchecked)
into that change's `tasks.md`, using the standard text editor so the
insertion is undoable and requires the user's own save.

#### Scenario: User copies tasks from an archived change

- **WHEN** the user right-clicks an archived change in the Archive tree and
  chooses "Copy tasks as template into…", then picks a non-archived change
- **THEN** `tasks.md` for the picked change opens in the editor with the
  template inserted
- **AND** the insertion is a normal, undoable text edit, not a silent file
  write

#### Scenario: No non-archived changes exist

- **WHEN** the user triggers the action but the workspace has no
  non-archived changes to pick as a target
- **THEN** the system reports that there is no valid target instead of
  offering an empty picker

### Requirement: Optional local-server embed signals its context to the standalone shell

When the optional local-server Webview mode is active, the extension SHALL
mark the iframe URL it builds for the standalone shell with a signal
identifying it as the VS Code local-server embed, distinct from a plain
standalone browser session. The extension SHALL NOT rely on the standalone
shell rendering its full section set inside this embed; native VS Code UI
(diff editor, tree views, native file editing) remains the source of truth
for the areas the embed does not show.

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

### Requirement: Changes and Archive trees expand to individual tasks, with reveal and scoped delete

Expanding a change node in either the "Changes" or "Archive" tree view
SHALL also list that change's individual `tasks.md` checklist items as
child tree items, alongside its existing artifact children. Selecting a
task item SHALL open (or reveal, if already open) `tasks.md` with the
cursor moved to that task's line, in both trees. A "Delete Task" action
SHALL be available only on task items belonging to an active (non-
archived) change; selecting it, after confirmation, SHALL remove exactly
that task's checklist line from the change's `tasks.md`. Task items
belonging to archived changes SHALL NOT offer a delete action.

#### Scenario: Expanding an active change shows its tasks

- **WHEN** the user expands a change node in the "Changes" tree
- **THEN** its individual `tasks.md` checklist items appear as child
  items alongside the existing artifact children

#### Scenario: Selecting a task reveals it in the editor

- **WHEN** the user selects a task tree item (in either tree)
- **THEN** `tasks.md` opens (or is revealed, if already open) with the
  cursor at that task's line

#### Scenario: Deleting a task from an active change

- **WHEN** the user confirms "Delete Task" on a task belonging to an
  active change
- **THEN** that exact line is removed from the change's `tasks.md`

#### Scenario: Archived tasks offer no delete action

- **WHEN** the user views a task item under the "Archive" tree
- **THEN** no delete action is available for it

#### Scenario: The underlying file changed since the tree was last refreshed

- **WHEN** the user attempts to delete a task whose stored position no
  longer matches the current content of `tasks.md`
- **THEN** the system reports that the task list has changed and makes no
  filesystem change, rather than risking deletion of a different line

