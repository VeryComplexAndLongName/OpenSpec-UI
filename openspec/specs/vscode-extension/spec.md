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

The embed SHALL carry a closed set of the shell's screens, and the URL SHALL
say which of them the embedding panel wants. A screen the set does not carry
SHALL NOT be shown in the embed, whatever the URL asks for.

The URL SHALL also say whether the editor's colour theme is light or dark,
and the embedded shell SHALL draw in that theme rather than in the one the
operating system prefers or a browser session remembers.

The embedded shell SHALL fill the panel, and only the shell SHALL scroll.

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

#### Scenario: A dark editor on a light system

- **WHEN** a panel embeds the shell while the editor's theme is dark and the
  operating system prefers light
- **THEN** the embedded shell is drawn dark

#### Scenario: The embed fills its panel

- **WHEN** a panel embeds the shell
- **THEN** the shell takes the panel's whole width and height, and the panel
  shows no scroll bar of its own

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
bridge round trip) and opens it in a webview showing the same view of the
change the standalone Timeline tab shows for one change, under the
change's name. Where the webview is narrow, the view SHALL keep every part
in one column. Opening timelines for different changes SHALL each open in
their own tab, not replace one another.

#### Scenario: User invokes the command on an active change

- **WHEN** the user invokes "Show Change Timeline" on an active change
  tree item
- **THEN** a new webview tab opens showing that change's timeline

#### Scenario: User invokes the command on an archived change

- **WHEN** the user invokes "Show Change Timeline" on an archived change
  tree item
- **THEN** the opened webview includes the change's archived date and
  where it was read from

#### Scenario: User opens timelines for two different changes

- **WHEN** the user invokes the command on two different changes in
  sequence
- **THEN** two separate webview tabs remain open, one per change

#### Scenario: The timeline computation fails

- **WHEN** computing the change's timeline throws
- **THEN** the extension shows an error message and does not open a
  webview

### Requirement: The Change Timeline webview flags stale pending tasks

The system SHALL flag, in the Change Timeline webview, any pending task
that stale-task detection identifies as stale, using a threshold
configurable via the `openspec-ui.staleTaskThresholdDays` setting
(default 14).

#### Scenario: A change has a stale pending task

- **WHEN** the user opens the Change Timeline for a change containing a
  pending task untouched past the configured threshold
- **THEN** that task is visually distinguished from a fresh pending
  task in the webview

#### Scenario: User changes the threshold setting

- **WHEN** the user sets `openspec-ui.staleTaskThresholdDays` to a
  different value and reopens the Change Timeline
- **THEN** the new threshold is used to determine staleness

### Requirement: A global command generates a downloadable sprint report

The system SHALL offer a Command Palette command, not tied to any
single tree item, that lets the user select multiple active and/or
archived changes, enter a sprint start and end date, and save a
generated PDF sprint report to a location of their choosing.

#### Scenario: User generates and saves a sprint report

- **WHEN** the user invokes "Generate Sprint Report (PDF)", selects one
  or more changes, enters a valid start and end date, and confirms a
  save location
- **THEN** a PDF file is written to that location and a confirmation
  message offers to open it

#### Scenario: User selects no changes

- **WHEN** the user cancels the change selection without picking any
  change
- **THEN** no date prompt appears and no report is generated

#### Scenario: User enters a malformed date

- **WHEN** the user types a value that is not a valid `YYYY-MM-DD` date
  into either date prompt
- **THEN** the prompt reports the problem and does not accept the value

#### Scenario: User cancels the save dialog

- **WHEN** the user picks changes and a valid date range but dismisses
  the save dialog
- **THEN** no PDF file is written

#### Scenario: Report generation fails

- **WHEN** building the sprint report or rendering the PDF throws
- **THEN** the extension shows an error message and does not write a
  file

### Requirement: Tree-scoped commands honour the tree's current selection

A command that acts on a change, template or task SHALL, when invoked
without one (as the Command Palette always invokes it), act on the row
currently selected in the view that owns that kind of item. It SHALL do
so only when exactly one row is selected and it is of the kind the
command expects; otherwise it SHALL show the message it already shows
when nothing is selected.

An item passed explicitly by the tree's own right-click menu SHALL always
take precedence over the selection.

#### Scenario: One matching row is selected

- **WHEN** a tree-scoped command is invoked with no item and exactly one
  row of the expected kind is selected in the owning view
- **THEN** the command acts on that row, subject to the same state checks
  as a right-click invocation

#### Scenario: Several rows are selected

- **WHEN** the same command is invoked with no item and more than one row
  is selected
- **THEN** it does not act on any of them and reports that a selection is
  needed, because choosing one would be a decision the user did not make

#### Scenario: The selected row is of another kind

- **WHEN** a change-scoped command is invoked with no item and the sole
  selection is a task row
- **THEN** it does not act on it and reports that a selection is needed

#### Scenario: Nothing is selected anywhere

- **WHEN** the command is invoked with no item and no row is selected
- **THEN** it reports that a selection is needed, naming the right-click
  menu as the alternative

#### Scenario: Invoked from the right-click menu

- **WHEN** the command is invoked with an explicit item
- **THEN** that item is used regardless of what is selected

### Requirement: Tree-scoped commands give explicit feedback when invoked without a selection

Every command that requires a tree item (a change, template, or task row)
to act on SHALL show a dismissible message instead of silently doing
nothing when invoked without one — including invocation via the Command
Palette, which passes no tree item.

#### Scenario: A tree-scoped command is invoked from the Command Palette with nothing selected

- **WHEN** a command that requires a change/template/task tree item is
  invoked with no item argument (e.g. via the Command Palette)
- **THEN** a warning message names the kind of item required (e.g.
  "select a change in the tree first") instead of the command silently
  returning with no observable effect

#### Scenario: No workspace is open

- **WHEN** a tree-scoped command is invoked with no workspace folder open
- **THEN** an error message says to open a folder or workspace first,
  instead of silently returning

#### Scenario: A valid tree item is passed

- **WHEN** a tree-scoped command is invoked with a valid item from an
  actual right-click on the tree
- **THEN** its existing behavior is unchanged

### Requirement: The relation between changes is visible in the editor

The extension SHALL present the relation changes state about each other,
read through the shared core module rather than parsed again.

That presentation SHALL be separate from the list where changes are
acted on. A relation graph shows a change once per parent, and a working
list must show it once — duplicated rows carrying Archive or Rollback
would offer the same destructive action several times for one change.

A change waiting on another that has not yet landed SHALL be presented as
waiting, so that what can be started now is answerable without opening a
file.

From a change, a reader SHALL be able to reach what that change follows,
without first locating it in the graph.

#### Scenario: Reading the graph

- **WHEN** the relation view is opened
- **THEN** it shows changes under the ones they follow, marking archived
  ones, and offers no action that mutates a change

#### Scenario: A change with more than one parent

- **WHEN** a change states that it follows more than one change
- **THEN** it appears under each, because the relation is a graph and
  dropping an edge would hide half of why the change exists

#### Scenario: A change waiting on another

- **WHEN** a change states a blocking relation on a change that is still
  active
- **THEN** it is presented as waiting on it

#### Scenario: Asking why a change exists

- **WHEN** a reader asks, from a change, what it follows
- **THEN** the chain back to the changes it grew out of is presented

#### Scenario: The working list is unchanged

- **WHEN** changes are listed for work
- **THEN** each appears once, with its actions, as before

### Requirement: A repository's own checks can be run from the editor

The extension SHALL be able to run the checks the workspace declares,
reusing the mechanism the harness already uses to run them rather than
introducing a second one.

Which command each check runs SHALL come from the workspace, not from the
extension. The extension SHALL NOT assume that a script of a given name
exists or means what it means here, and SHALL offer nothing for a check
the workspace does not declare, rather than offering a command that
fails.

A workspace SHALL be able to expose a command to the editor that differs
from the one it runs itself, so that a faster subset can be offered
without renaming anything.

A check's result SHALL name the command that ran and what came back, so a
failure is actionable without re-running it in a terminal.

#### Scenario: The workspace declares a check

- **WHEN** a workspace declares the script a check maps to
- **THEN** the check can be run from the editor, and its result names the
  command and its output

#### Scenario: The workspace declares nothing

- **WHEN** a workspace declares no script for a check
- **THEN** the extension offers no command for it

#### Scenario: The workspace offers the editor a different command

- **WHEN** a workspace exposes a command intended for the editor
  alongside its own
- **THEN** the editor runs the one intended for it

#### Scenario: A check fails

- **WHEN** a check run from the editor fails
- **THEN** the failure states which command ran and what it returned

### Requirement: What is waiting on a person is visible in one place

The extension SHALL present every open item that is marked as requiring a
person, across all active changes, in one place.

Each item SHALL name the change it belongs to and be reachable from it,
so that acting on it does not begin with a search.

The presentation SHALL NOT offer a way to mark such an item done. The
rule those items live by is that a person reports them done after
observing the thing; a control on a surface that cannot observe it would
turn the rule into a formality.

#### Scenario: Several changes are waiting on a person

- **WHEN** active changes carry open items marked as requiring a person
- **THEN** all of them are listed together, each naming its change

#### Scenario: Nothing is waiting

- **WHEN** no active change carries such an item
- **THEN** the surface says so rather than showing an empty list

#### Scenario: Acting on one

- **WHEN** one is selected
- **THEN** the change it belongs to is reachable from it

#### Scenario: The rule is not bypassed

- **WHEN** such an item is presented
- **THEN** no control marks it done from this surface

### Requirement: A change can be located in the other view on request

Where a change is shown in more than one view, the editor SHALL offer to
locate it in the other on request, rather than requiring the reader to
find it by eye.

Locating SHALL be an explicit action by default. Following the selection
automatically SHALL be available as an opt-in setting, because a view
that shows only related changes has nothing to reveal for most of them,
and a behaviour that silently does nothing most of the time is
indistinguishable from one that is broken.

Where the change occupies more than one row — which happens when it
follows more than one other change — every row SHALL be revealed, and the
count SHALL be reported. Choosing one row on the reader's behalf hides
exactly the relationship that made the change occupy several.

Where the change does not appear in the other view at all, the action
SHALL say so plainly rather than appearing to do nothing.

#### Scenario: The change states a relation

- **WHEN** the reader asks to locate a change that appears in the
  relation view
- **THEN** that view reveals it and selects it

#### Scenario: The change occupies several rows

- **WHEN** the change follows more than one other change
- **THEN** every row for it is revealed, and the reader is told how many
  there are

#### Scenario: The change states no relation

- **WHEN** the reader asks to locate a change that the relation view does
  not show
- **THEN** the editor says the change states no relation, and no view
  changes

#### Scenario: Locating from the relation view

- **WHEN** the reader asks to locate a row from the relation view
- **THEN** the change is revealed in the list that holds it, which is the
  archive for an archived change and the active list otherwise

#### Scenario: Following the selection is not on by default

- **WHEN** the reader has not enabled it
- **THEN** selecting a change changes no other view

### Requirement: A row the tree rebuilds carries the same facts as the row it drew

Where the extension answers "what is this element's parent", the row it
returns SHALL carry the same state as the row built from the workspace,
and SHALL NOT substitute a fixed value for a fact it did not look up.

A row's description and icon are how a person reads its state. A rebuilt
row that answers the question with a written-in value shows a state
nothing derived, and shows it in the same place the derived one appears.
VS Code renders what this answer returns — it restores the tree's
selection through the parent chain after a window reload — so the
substitution is visible, not internal.

Where no parent is known, the answer SHALL be that there is none, rather
than a row assembled from defaults.

#### Scenario: The parent of an artifact under a finished change

- **WHEN** the parent of an artifact belonging to a change whose tasks
  are all done is asked for
- **THEN** the row returned reads as implemented, the same as the row
  the tree drew

#### Scenario: An artifact belonging to no change

- **WHEN** the parent of a workspace-level artifact is asked for
- **THEN** there is none, and no row is assembled

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

### Requirement: A change's harness settings open in a panel of their own

Configuring the harness for a change SHALL open a panel for that change,
titled with the change's name. Configuring the same change again SHALL show
that panel rather than open another.

The global harness settings SHALL open in a panel of their own.

The process dashboard SHALL NOT host the harness settings.

#### Scenario: Configuring a change

- **WHEN** the command is run on a change in the Changes tree
- **THEN** a panel titled with that change's name shows that change's
  settings, already loaded

#### Scenario: Configuring it again

- **WHEN** the command is run on the same change while its panel is open
- **THEN** that panel is shown, and no second panel opens

### Requirement: An enrolment request is shown in the Human-Only Inbox, and confirmed there

The extension SHALL show each enrolment request in the Human-Only Inbox,
with its label, working directory, machine, git author and time, and SHALL
offer an action on the request that confirms the person started the run.

#### Scenario: A request in the editor

- **WHEN** a key awaits enrolment
- **THEN** the Human-Only Inbox lists the request with those facts, and its
  action confirms it

### Requirement: The Changes tree says where each change stands

The Changes tree SHALL show each active change's standing, as
`packages/core` describes it:

- in the item's description, as the standing's word;
- in a file decoration, as a colour that agrees with the word, a one-letter
  badge, and the word as its tooltip.

While the Changes view is visible, the extension SHALL read standings again
on the `openspec/**` watcher's events. It SHALL fetch refs, without touching
any working tree, at most once per fetch interval.

While the Changes view is visible, the extension SHALL also read which runs
are live again whenever a run's status record is written, renewed or
removed. That reading SHALL come from the status records alone: it SHALL NOT
run git, fetch refs or ask `gh`. The runs SHALL be laid over the standings
the tree holds by the same core function a Pipeline card uses, and an item
SHALL be drawn again only where its word, colour or badge changed.

#### Scenario: A change running in another worktree

- **WHEN** a status record says a run in another working directory is on a
  change
- **THEN** that change's item says it is running there, and names the
  directory

#### Scenario: A run starts on a change

- **WHEN** the Changes view is visible, and a run starts on a change and
  writes its status record before it ticks any task
- **THEN** within a few seconds the change's item says Running, with no
  Refresh, and no git command runs for it

#### Scenario: A run ends without touching the change

- **WHEN** a run on a change is stopped before it ticks any task, and its
  status record is removed
- **THEN** within a few seconds the change's item no longer says Running

#### Scenario: A running run renews its record

- **WHEN** a run's status record is rewritten with nothing on it changed but
  its heartbeat
- **THEN** no item is drawn again, and no git command runs

#### Scenario: Refreshing the Changes tree

- **WHEN** the person runs the Changes view's Refresh
- **THEN** the extension reads the files again and fetches refs at once,
  whatever the fetch interval, and every item's standing reflects what was
  fetched

#### Scenario: The colour agrees with a word that is always present

- **WHEN** the theme's colours cannot be told apart by the reader
- **THEN** each item's description and tooltip still state the standing in
  words

### Requirement: Cancelling a chain from the Processes tree stops the chain

Cancelling a chain's process from the Processes tree SHALL cancel the chain
itself, identified by the chain's own run id. It SHALL NOT only withdraw the
chain's entry from the scheduler while the chain runs on.

#### Scenario: A running chain

- **WHEN** Cancel Process is used on a running chain in the Processes tree
- **THEN** the chain is cancelled, and its agent's process ends

### Requirement: The extension is marked by the owl

The extension's manifest icon SHALL be the project's owl logo in colour.

The Activity Bar icon of the extension's view container SHALL be a
monochrome owl drawn in `currentColor`. VS Code paints that icon in a
single theme colour, and a colour image would show there as a solid shape.

The message-bridge webview's headline SHALL show the owl as the standalone
shell does, in its own colours. That webview's Content Security Policy
SHALL allow `data:` images, and SHALL NOT allow images from anywhere else.

#### Scenario: The Activity Bar in a dark and a light theme

- **WHEN** the extension is active, in a dark theme and then in a light
  theme
- **THEN** its Activity Bar entry shows an owl outline in that theme's icon
  colour

#### Scenario: The AI panel's headline

- **WHEN** the AI panel opens through the message bridge
- **THEN** the owl is shown at the left of its "OpenSpec UI" headline

### Requirement: An editor webview's policy lets the shell's icons draw

Every editor webview that runs a bundle SHALL allow fonts from `data:` in its
Content Security Policy, so that the icon font the shell's stylesheet carries
is loaded. It SHALL NOT allow fonts from any other source.

#### Scenario: A panel with an icon in its title

- **WHEN** the global Harness Settings panel opens in the editor
- **THEN** the gear beside "Global harness settings" is drawn, not an empty
  box

#### Scenario: A new panel

- **WHEN** a webview that runs a bundle is added without allowing `data:`
  fonts
- **THEN** the extension's tests fail and name its source file

### Requirement: A global command compares every change on a grid of days

The system SHALL offer a Command Palette command, not tied to any single
tree item, that opens a webview comparing every change of the workspace on
a grid whose columns are days — the same screen the standalone shell draws,
with the editor's own colours.

The command SHALL NOT ask which changes to compare. Picking from a list of
every change in the workspace is the work the screen exists to do, and the
editor's answer to "how did this project's changes run" must be the
browser's answer, not a different one.

The webview SHALL be able to ask the extension host for the histories of
the changes it is showing, so its charts rest on the same data the
one-change timeline does, and SHALL state a failed request rather than
leaving the charts blank. A row SHALL open that change's own timeline
panel.

Where reading the workspace fails, the extension SHALL say so and open no
webview.

#### Scenario: Opening the comparison

- **WHEN** the user invokes "Show Change Comparison Timeline"
- **THEN** a webview opens with every active and archived change drawn as a
  bar from proposed to archived, with no selection asked for first

#### Scenario: Opening a change from its row

- **WHEN** the user activates a row in the comparison
- **THEN** that change's own timeline panel opens

#### Scenario: The charts cannot be read

- **WHEN** the webview asks for the histories behind its charts and the
  read fails
- **THEN** the webview says the charts could not be read, and the grid
  stays as it is

#### Scenario: The workspace cannot be read

- **WHEN** reading the workspace's dates throws
- **THEN** the extension shows an error message and does not open a webview

