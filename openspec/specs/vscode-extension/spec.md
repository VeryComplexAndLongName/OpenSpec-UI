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
SHALL list that change's artifacts as child tree items. The `tasks.md`
artifact SHALL be collapsible when the file exists (a plain leaf, like
every other artifact, when it doesn't), and expanding *it* — not the
change node — SHALL list that change's individual `tasks.md` checklist
items as its children; task items SHALL NOT appear as direct children
of the change node itself. Every tree item in these views SHALL have a
stable identity derived from data already unique at its scope (not
label-derived, not dependent on object identity surviving a refresh),
distinct from its parent's identity, so that nesting and collapse state
survive tree refreshes. Selecting a task item SHALL open (or reveal, if
already open) `tasks.md` with the cursor moved to that task's line, in
both trees. A "Delete Task" action SHALL be available only on task
items belonging to an active (non-archived) change that are not marked
done; selecting it, after confirmation, SHALL remove exactly that
task's checklist line from the change's `tasks.md`. Task items
belonging to archived changes, and done task items in active changes,
SHALL NOT offer a delete action.

#### Scenario: Expanding an active change shows its tasks

- **WHEN** the user expands a change node in the "Changes" tree
- **THEN** its artifacts appear as child items, and the "Tasks" artifact
  is collapsible while every other artifact is not

#### Scenario: Individual tasks nest under Tasks, not under the change directly

- **WHEN** the user expands the "Tasks" artifact under a change
- **THEN** that change's individual `tasks.md` checklist items appear as
  its children, and none of them appeared as direct children of the
  change node itself

#### Scenario: Task identity is distinct from its parent Change

- **WHEN** the Tasks artifact's children are computed
- **THEN** each task item's id is distinct from the Tasks artifact's own
  id, from the parent Change's id, and from every sibling's id

#### Scenario: Selecting a task reveals it in the editor

- **WHEN** the user selects a task tree item (in either tree)
- **THEN** `tasks.md` opens (or is revealed, if already open) with the
  cursor at that task's line

#### Scenario: Deleting a task from an active change

- **WHEN** the user confirms "Delete Task" on a task belonging to an
  active change that is not marked done
- **THEN** that exact line is removed from the change's `tasks.md`

#### Scenario: Archived tasks offer no delete action

- **WHEN** the user views a task item under the "Archive" tree
- **THEN** no delete action is available for it

#### Scenario: Done tasks offer no delete action, even in active changes

- **WHEN** the user views a task item marked done (`- [x]`) under an
  active change in the "Changes" tree
- **THEN** no delete action is available for it, and invoking the delete
  command directly with that item makes no change to `tasks.md`

#### Scenario: The underlying file changed since the tree was last refreshed

- **WHEN** the user attempts to delete a task whose stored position no
  longer matches the current content of `tasks.md`
- **THEN** the system reports that the task list has changed and makes no
  filesystem change, rather than risking deletion of a different line

### Requirement: Changes tree surfaces repository-setup actions

The "Changes" tree view SHALL show a "Repository Setup" node, always
present regardless of workspace initialization state, positioned
immediately after "OpenSpec Configuration". Expanding it SHALL list the
three repository-bootstrap actions ("Generate Agent Instructions",
"Configure Dependabot", "Generate Path-Scoped Copilot Instructions") as
child items; selecting one SHALL run the corresponding existing command
(`openspec-ui.generateAgentInstructions`,
`openspec-ui.configureDependabot`, `openspec-ui.generateSubtypeInstructions`)
unchanged, including its project-type `QuickPick` prompt. The "Archive"
tree SHALL NOT show this node.

#### Scenario: Repository Setup node is always visible

- **WHEN** the user opens the "Changes" tree, regardless of whether any
  changes exist
- **THEN** a "Repository Setup" node is shown immediately after "OpenSpec
  Configuration"

#### Scenario: Selecting a repository-setup action runs its command

- **WHEN** the user expands "Repository Setup" and selects "Generate
  Agent Instructions"
- **THEN** the `openspec-ui.generateAgentInstructions` command runs,
  including its existing project-type prompt

#### Scenario: Archive tree has no Repository Setup node

- **WHEN** the user opens the "Archive" tree
- **THEN** no "Repository Setup" node is shown

### Requirement: Changes and Archive trees offer whole-Change rollback

A "Rollback Change" action SHALL be available on a Change item in either
the "Changes" or "Archive" tree view. Selecting it, when at least one
rollback-eligible process exists for that Change, SHALL show a
confirmation naming the affected file and process counts before
proceeding; when no rollback-eligible process exists, the system SHALL
report that instead of prompting for confirmation.

#### Scenario: Rollback from the Changes tree

- **WHEN** the user selects "Rollback Change" on an active Change with
  rollback-eligible processes
- **THEN** a confirmation shows the affected file and process counts
- **AND** confirming restores those files and refreshes the trees

#### Scenario: Rollback from the Archive tree

- **WHEN** the user selects "Rollback Change" on an archived Change with
  rollback-eligible processes
- **THEN** the same confirmation and restore behavior applies, unmodified
  by archive status

#### Scenario: No rollback-eligible processes

- **WHEN** the user selects "Rollback Change" on a Change with no
  rollback-eligible processes
- **THEN** the system reports this without showing a confirmation dialog

### Requirement: Archiving a change offers a Changesets reminder when appropriate

For a workspace that has adopted Changesets (`.changeset/config.json`
exists), the extension SHALL check, after a successful archive, whether
any changeset is currently pending, and SHALL offer to start `npx
changeset` in an integrated terminal when none is. A workspace that has
not adopted Changesets SHALL see no such reminder. The check SHALL NOT
block, delay, or affect the outcome of the archive operation.

#### Scenario: Archiving with Changesets adopted and nothing pending

- **WHEN** a change is archived in a workspace with
  `.changeset/config.json` and no pending `.changeset/*.md` file
- **THEN** the extension shows an information message offering to run
  `npx changeset`
- **AND** choosing that action opens an integrated terminal and runs
  `npx changeset`

#### Scenario: Archiving with a changeset already pending

- **WHEN** a change is archived in a workspace with
  `.changeset/config.json` and at least one pending `.changeset/*.md`
  file
- **THEN** no reminder is shown

#### Scenario: Archiving in a workspace that has not adopted Changesets

- **WHEN** a change is archived in a workspace with no
  `.changeset/config.json`
- **THEN** no reminder is shown

#### Scenario: The reminder check fails

- **WHEN** the Changesets presence/pending check throws or the
  filesystem is unreadable
- **THEN** the archive operation's own success result is unaffected
- **AND** no error is surfaced for the failed check

### Requirement: A per-change context-menu command shows a change timeline webview

The system SHALL offer a context-menu command, on both active and
archived change tree items, that computes that change's timeline
directly (via a direct `execution-core` import — no HTTP, no message
bridge round trip) and opens it in a webview showing the change's
proposal/design/spec content followed by its tasks positioned by
best-effort completion date. Opening timelines for different changes
SHALL each open in their own tab, not replace one another.

#### Scenario: User invokes the command on an active change

- **WHEN** the user invokes "Show Change Timeline" on an active change
  tree item
- **THEN** a new webview tab opens showing that change's timeline

#### Scenario: User invokes the command on an archived change

- **WHEN** the user invokes "Show Change Timeline" on an archived
  change tree item
- **THEN** the opened webview includes the change's archived date

#### Scenario: User opens timelines for two different changes

- **WHEN** the user invokes the command on two different changes in
  sequence
- **THEN** two separate webview tabs remain open, one per change

#### Scenario: The timeline computation fails

- **WHEN** computing the change's timeline throws
- **THEN** the extension shows an error message and does not open a
  webview

