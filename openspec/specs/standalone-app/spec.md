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
and clean retained history. The inspection SHALL be shown with the run it
belongs to, and a request to inspect SHALL be visibly answered where it was
made.

#### Scenario: Interrupted process is opened in standalone

- **WHEN** the user loads Processes for the workspace
- **THEN** the UI identifies the process as interrupted and displays its recovery details

#### Scenario: User confirms rollback

- **WHEN** the checkpoint remains conflict-free
- **THEN** standalone restores the checkpoint through core and displays the rolled-back state

#### Scenario: Details open with the run they belong to

- **WHEN** the user asks to review a run in a list of many
- **THEN** the run's details, its changed files and its rollback control appear
  directly below that run's own row, and no other run's row is opened

#### Scenario: A second request replaces the first

- **WHEN** the user asks to review another run while one is open
- **THEN** the first closes and the second opens under its own row

#### Scenario: The list can be narrowed

- **WHEN** the user narrows the list by a word
- **THEN** only the runs whose operation, change, agent or state carry that
  word remain, and the view says what it is filtered by and how many of how
  many it shows

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
Run a Command execution). A tab's content MAY defer mounting until the
user opens that tab for the first time; once a tab has been opened, it
SHALL keep its mounted state for the rest of the session (including its
in-progress state), matching the behavior of a tab that was never
deferred.

A tab that is reading — on opening, or from one of its own controls, or
because the list it offers has not yet been read — SHALL say so until that
reading settles or fails. It SHALL show a moving indicator and one sentence
naming what is being read, exposed as a status message rather than taking
focus, and SHALL show how long the reading has taken once it passes a few
seconds. Its controls SHALL be unavailable while it reads. Its label in the
tab row SHALL show that it is reading, whichever tab is open, without
changing the label's accessible name. Where the person prefers reduced
motion, the indicators SHALL stand still and the sentence SHALL remain. A
tab that is not reading SHALL show none of this.

A reading that returns within a moment SHALL show no indicator, and showing
or hiding an indicator SHALL NOT move the tab row's other tabs.

A run in progress is not a reading: its own controls, such as the one that
cancels it, SHALL stay available.

#### Scenario: User switches from Change Editor to Run a Command

- **WHEN** the user has unsaved edits in the Change Editor tab and switches
  to the Run a Command tab
- **THEN** the Change Editor tab retains the unsaved edits when the user
  switches back

#### Scenario: A tab's content is not mounted before it is first opened

- **WHEN** the standalone shell loads and the user has not yet clicked a
  given tab
- **THEN** that tab's content, including anything it would otherwise
  fetch or compute on mount, has not started

#### Scenario: A previously-opened tab keeps its state after switching away and back

- **WHEN** the user opens a tab, changes its in-progress state, switches
  to a different tab, and switches back
- **THEN** the tab's in-progress state is unchanged, identical to a tab
  that was never deferred

#### Scenario: A tab whose first reading is slow

- **WHEN** the user opens a tab that reads on mount and the reading has not
  returned
- **THEN** the tab shows a moving indicator and one status message naming
  what it is reading, its controls are unavailable, and its label in the
  tab row shows it is reading
- **AND** all of that goes when the reading settles or fails

#### Scenario: A tab left while it reads

- **WHEN** the user opens a tab whose reading is slow and switches to
  another tab before it returns
- **THEN** the first tab's label still shows that it is reading, until the
  reading settles or fails

#### Scenario: A reading that returns at once

- **WHEN** the user presses a control whose reading returns within a moment,
  such as a row's Review in Processes and Recovery
- **THEN** no indicator appears, and nothing on the screen moves

#### Scenario: A person who prefers reduced motion

- **WHEN** a tab reads for a person whose system asks for reduced motion
- **THEN** the indicators do not move, and the sentence still names the
  reading

#### Scenario: A run in progress

- **WHEN** a command is running in Run a Command
- **THEN** that tab's control to cancel the run stays available

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
or archived change and sees when its work happened. Choosing a change
SHALL load it, with no further control to press.

The tab SHALL show:

- the moments the change has a time for, oldest first: when it was
  proposed, each moment tasks were ticked, and when it was archived. Tasks
  ticked at the same instant SHALL be one moment that says how many;
- how many of its tasks are done, of how many, and how long it took from
  its proposal to its archive, or to its last work while it is active;
- its proposed, first worked, last worked and archived dates, each with
  where it was read from;
- its open tasks, and its done tasks whose completion date cannot be
  determined, listed apart from the moments rather than omitted or given a
  misleading date;
- its proposal, design and spec content, on request.

Times SHALL be shown in the viewer's own time zone, and the tab SHALL say
so.

#### Scenario: User selects an active change

- **WHEN** the user selects an active change in the Timeline tab
- **THEN** the tab shows that change's moments oldest first, its open
  tasks, and how long it has run to its last work

#### Scenario: User selects an archived change

- **WHEN** the user selects an archived change in the Timeline tab
- **THEN** the tab shows the same, ending with the moment it was
  archived, and the span from its proposal to its archive

#### Scenario: User chooses another change while one is shown

- **WHEN** a change's timeline is shown and the user chooses another
- **THEN** the shown timeline goes at once, and nothing on the page names
  the change chosen before while the other is read

#### Scenario: Tasks ticked in one commit

- **WHEN** twenty-seven tasks of a change carry the same completion instant
- **THEN** the tab shows one moment saying twenty-seven tasks were ticked
  in one commit, lists the first of them, offers the rest, and says why
  they share a time

#### Scenario: A task wrapped over several lines

- **WHEN** a task's sentence runs over three lines of `tasks.md`
- **THEN** the tab shows the whole sentence, without its Markdown marks, and
  not only its first line

#### Scenario: A task has no determinable completion date

- **WHEN** a task is still pending, or its completion date cannot be
  determined
- **THEN** it is listed apart from the moments, without a date, rather
  than omitted or given a misleading date

#### Scenario: Where a date came from

- **WHEN** a change's proposed date was read from a git commit and its
  last worked date from git blame on its tasks
- **THEN** the tab says so beside each date

### Requirement: The Timeline tab's staleness threshold is user-configurable

The system SHALL let the user set the stale-pending-task threshold (in
days) in the standalone Timeline tab, defaulting to 14 days, and apply
it when rendering a change's timeline.

#### Scenario: User changes the threshold

- **WHEN** the user sets a different stale-after value while a change's
  timeline is shown
- **THEN** open tasks are flagged stale according to the new value, without
  the timeline being read again

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

### Requirement: The standalone shell is marked by the owl

The standalone browser shell SHALL show the project's owl logo at the
left of its headline, 40 CSS pixels square, with an image twice that size
for high-density screens.

The logo SHALL be decorative. It SHALL carry an empty text alternative, so
the headline's accessible name stays "OpenSpec UI".

The page SHALL name the owl as its icon.

The shell SHALL fetch neither image from another origin, nor from a path
the server does not already serve.

#### Scenario: The headline shows the owl

- **WHEN** a user opens the server's launch URL in a browser
- **THEN** the owl is shown at the left of the "OpenSpec UI" headline, and
  the level-one heading is still named "OpenSpec UI"

#### Scenario: The browser tab shows the owl

- **WHEN** the page has loaded
- **THEN** the document names an icon, and that icon is the owl

### Requirement: The standalone shell wears the project site's frame

The standalone shell SHALL frame every tab as ADR 0033's approved mockup
does: an application bar carrying the product's mark and name, the workspace
path and the theme control; a page head naming the open tab in its one
level-one heading, with a tagline and the sentence that says what the tab is
for; one row of tabs; and a footer carrying the versions.

Each tab SHALL show a short label and SHALL keep its full name as its
accessible name, and the short label SHALL be part of that name.

The frame's colours SHALL come from named tokens, in a light and a dark
palette, and every pair of text and ground it draws SHALL meet WCAG AA.

The VS Code webviews SHALL NOT take the frame, and SHALL keep taking every
colour from the editor's theme.

#### Scenario: A tab is opened

- **WHEN** the user opens any tab of the standalone shell
- **THEN** the page head's level-one heading names that tab, and the tab's
  short label is underlined in the tab row

#### Scenario: A tab found by its name

- **WHEN** assistive technology or a test looks a tab up by its full name,
  such as "OpenSpec view summary"
- **THEN** it finds the tab whose visible label is "Summary"

#### Scenario: Both themes

- **WHEN** the frame is drawn in the light theme and in the dark theme
- **THEN** every text in it meets WCAG AA against the ground it sits on

#### Scenario: VS Code

- **WHEN** a VS Code webview renders a component the shell shares
- **THEN** it shows no application bar, page head or footer, and its colours
  come from the editor's theme

### Requirement: The OpenSpec view summary is laid out as ADR 0033's mockup

The standalone shell's OpenSpec view summary SHALL present, in this order:
four tiles — the active changes, the archived changes with the latest day
one was archived, the specs with their total requirements, and the items
waiting on a person — each with its figure and a note; a panel of the active
changes, each row giving the change's name, its state as a word, its task
progress as a bar with the done and total counts, and the day it was last
modified; and, side by side, the specs with the most requirements and the
most recently archived changes, each able to show its full list.

Dates on the summary SHALL be shown as days a person reads, with the full
timestamp still available. Nothing the summary offered before — the full
archive and its search, every spec, the waiting list with its run controls
and enrolment requests, where the workspace was read from — SHALL be removed.

#### Scenario: A workspace with active and archived changes

- **WHEN** the summary has read a workspace with active changes, archived
  changes and specs
- **THEN** it shows the four tiles, the changes panel, and the specs and
  recently archived panels side by side

#### Scenario: The full archive

- **WHEN** the person asks for all archived changes
- **THEN** every archived change is listed, with the search it had before

#### Scenario: A change's row

- **WHEN** a change has done 25 of 27 tasks and was last modified on 16
  September
- **THEN** its row shows a bar, "25 / 27" and "16 Sep"

#### Scenario: A workspace with no specs and nothing archived

- **WHEN** the summary has read a workspace with no specs and no archived
  changes
- **THEN** the specs panel says there are no specs and the recently archived
  panel says nothing is archived, neither drawing a table with no rows

### Requirement: Harness Settings is laid out as ADR 0033's mockup

The standalone shell's Harness Settings tab SHALL present, in this order: the
named configurations as a segmented choice with a control that applies the
chosen one to the form and a description under them; what the configuration
cannot do, where there is anything, as a warning callout; and a settings
panel whose stages are rows of a table — number and name, agent, model,
effort and max cost — with the mechanical stages as rows that say they run
without an agent, followed by the autonomy level, the review gate and the
run budget side by side, and Save and Discard at its foot.

The page head SHALL offer the global file, showing what Save would write.

Nothing the tab offered before — custom agents and what is said about them,
the findings, the unsaved-changes note, where the file is saved — SHALL be
removed.

#### Scenario: The tab on a configured workspace

- **WHEN** Harness Settings is opened on a workspace whose global file names
  an agent for each configurable stage
- **THEN** each of propose, review, apply and verify is one row with its
  agent, model, effort and max cost, archive and git are rows that run
  mechanically, and the autonomy level, review gate and run budget are side
  by side under them

#### Scenario: The file

- **WHEN** the page head's file action is used
- **THEN** the JSON that Save would write is shown on the tab

### Requirement: The Timeline tab's change is found by typing part of its name

The Timeline tab SHALL let the user find the change to show by typing part
of its name. It SHALL list, as the user types, the active and archived
changes whose name holds every word typed, and SHALL let the user choose one
with the keyboard or the mouse. Choosing SHALL load that change's timeline
at once. Active changes SHALL be listed before archived ones, and archived
ones newest first.

#### Scenario: A change among hundreds

- **WHEN** the workspace has hundreds of archived changes and the user types
  two words of one change's name
- **THEN** the list shows only the changes whose names hold both words, and
  choosing one loads its timeline

#### Scenario: Nothing matches

- **WHEN** the user types a name no change has
- **THEN** the tab says no change matches, and the timeline shown stays as
  it was

#### Scenario: Chosen with the keyboard

- **WHEN** the user moves through the matches with the arrow keys and presses
  Enter
- **THEN** the highlighted change's timeline loads, and Escape instead closes
  the list without choosing

### Requirement: The Timeline tab compares every change on a grid of days

The Timeline tab's comparison SHALL draw every change of the workspace on a
grid whose columns are days, without first asking which changes to compare
or over which dates.

What to compare is the question the reader came with. A mode that answers
it with a list of 264 changes and two date fields asks them to do the
work first, and shows nothing until they have.

Each change SHALL be drawn as a bar from when it was proposed to when it
was archived, placed by the hour within its day, so how long a change took
is read as a length rather than reconstructed from two markers. An active
change's bar SHALL run to a marked line for now and be distinguishable from
an archived one by more than position. A bar SHALL carry that change's task
figures beside it: how many tasks an archived change had, and how many of
how many are done in an active one.

The period SHALL be chosen from fixed choices, one of which covers the
whole history, and days that are a weekend SHALL be distinguished from
working days. A bar cut by the edge of the period SHALL be drawn as cut
rather than as beginning or ending there.

Rows SHALL be narrowable by typing part of a change's name, with the
narrowed count stated against the total. A row SHALL open that change's own
timeline.

What a project finished SHALL still be readable as a chart under the grid,
over the changes the grid is showing. The charts rest on each change's
whole history, which is read after the grid is drawn; while it is being
read, the screen SHALL say so rather than leaving the reader with an empty
space.

A change whose proposed date cannot be read SHALL keep its row, saying it
carries no dates, rather than being dropped or drawn at a guessed date.

#### Scenario: Entering the comparison

- **WHEN** the user chooses "Compare changes"
- **THEN** the workspace's changes are read once and drawn, with no
  selection or date range asked for

#### Scenario: Choosing a period

- **WHEN** the user chooses another period from the segmented control
- **THEN** the grid redraws over those days, with "All" running from the
  earliest proposed day to today

#### Scenario: An active change

- **WHEN** a change has not been archived
- **THEN** its bar runs to the line marking now, and the legend says which
  colour means active and which archived

#### Scenario: A change that began before the period

- **WHEN** a change was proposed before the first day shown and is still
  open in it
- **THEN** its row is shown with its bar cut at that edge rather than
  starting there

#### Scenario: Narrowing by name

- **WHEN** the user types part of a change's name
- **THEN** only matching rows are drawn, and the screen says how many of
  how many match

#### Scenario: Opening a change from its row

- **WHEN** the user activates a row
- **THEN** that change's own timeline is shown

#### Scenario: The charts under the grid

- **WHEN** the grid has been drawn and the histories of its changes are
  still being read
- **THEN** the screen says the charts are being read, and draws them over
  those changes once they arrive

#### Scenario: A change that cannot be dated

- **WHEN** a change carries no readable proposed date
- **THEN** its row is drawn without a bar and says it carries no dates

### Requirement: Diff Preview shows a change's own diff

The standalone shell's Diff Preview tab SHALL show what the repository
reports as changed for a change the person chooses, and SHALL NOT show a
sample in place of it.

The server SHALL expose a token-gated route that answers, for a workspace and
an active change, the diff of that change's own directory as the repository's
own tool reports it. It SHALL refuse a change that is not active in that
workspace.

The answer SHALL be bounded in size, and SHALL say when it was cut rather
than appearing complete.

Where the workspace is not a repository, or the change has nothing
uncommitted, the shell SHALL say which of the two it is, in words.

#### Scenario: A change with uncommitted work

- **WHEN** the person opens Diff Preview and chooses a change whose files
  have uncommitted edits
- **THEN** the tab shows the diff of that change's own directory

#### Scenario: A change with nothing uncommitted

- **WHEN** the chosen change has no uncommitted edits
- **THEN** the tab says so, and shows no diff

#### Scenario: A change that is not active

- **WHEN** a name is asked for that is not an active change of that workspace
- **THEN** the route refuses it and the tab says so

#### Scenario: A workspace that is not a repository

- **WHEN** the workspace is not a repository
- **THEN** the tab says that, rather than showing an empty diff

#### Scenario: A diff too large to send whole

- **WHEN** the diff exceeds the size the route sends
- **THEN** the tab shows what was sent and says that it was cut

### Requirement: Every tab is drawn from the shared components

Every tab of the standalone shell SHALL be drawn from the shared
components, not only the tabs a mockup drew: a panel that names what it
holds, one toolbar for the tab's controls, a table for rows, a badge for a
state or an origin, and the panel's own words when there is nothing to
show.

Five tabs were left on the pre-redesign markup when the mockup's screens
were redrawn — Run a Command, Processes, Diff Preview, Change Editor and
Templates. Read on 2026-09-18, none of them had a panel head, every control
row was the old one, two tables were the old class, four headings sat loose
in a panel, the Change Editor rolled its own tab strip, and Templates drew
nothing at all until a button was pressed. A product where half the screens
are one thing and half another is a product that looks unfinished, whatever
each half is worth on its own.

Redrawing a tab SHALL NOT change what it is driven by: the name, role and
test handle of every control stay as they are, so that a screen's markup
can be moved without moving what a person or a test reaches for.

Where the same markup is drawn inside a host editor, the mapping that gives
it the editor's colours SHALL move with it, and a token left unmapped SHALL
fail a check rather than reach a screen.

#### Scenario: A tab names what it holds

- **WHEN** any tab of the shell is shown
- **THEN** its content sits in panels whose heads name them, rather than in
  one unnamed block

#### Scenario: A tab's controls

- **WHEN** a tab offers controls that act on the whole tab
- **THEN** they sit in one toolbar of the same shape every other tab uses

#### Scenario: Rows and states

- **WHEN** a tab lists rows carrying a state, an origin or a kind
- **THEN** the rows are a table and the state is a badge, as the redesigned
  lists draw them

#### Scenario: Nothing to show

- **WHEN** a tab has nothing to list, including before anything has been
  loaded
- **THEN** its panel says so, rather than drawing nothing

#### Scenario: The same markup in the editor

- **WHEN** a screen the extension also draws is redrawn
- **THEN** the editor's own colours still reach it, and a token the editor
  layer fails to map fails a check

### Requirement: The Summary says what the workspace left behind

The Summary SHALL say what the workspace left behind: the directories under
`openspec/changes/` that carry no documents, and the working directories
that are finished with.

A leftover the product cleared SHALL be named after it is cleared, so a
directory does not simply disappear. A leftover the product will not clear
SHALL be offered for removal, with what it holds stated beside the offer,
and a working directory that is finished with SHALL be offered the same
way, with what made it finished.

Where nothing was left behind, the Summary SHALL say nothing rather than
show an empty panel.

#### Scenario: An archived change's leavings were cleared

- **WHEN** the reading cleared a directory whose change is archived
- **THEN** the Summary names the directory and says it was cleared

#### Scenario: Something the product will not clear

- **WHEN** a directory carries no documents and no change of its name is
  archived
- **THEN** the Summary names it, says what it holds, and offers to remove it

#### Scenario: A working directory that is finished with

- **WHEN** a surveyed working directory's branch has merged and its tree is
  clean
- **THEN** the Summary names it with its branch and offers to remove it

#### Scenario: Nothing left behind

- **WHEN** every directory under `openspec/changes/` is a change and every
  working directory still has work
- **THEN** the Summary shows no panel for this

### Requirement: The Timeline tab opens a sprint report for printing

The system SHALL offer, within the Timeline tab, a mode where the user
picks a date range and multiple active and/or archived changes, and then
opens the generated sprint report as a page, from which the browser's own
print prepares a PDF.

`POST /api/sprint-report` SHALL return that page as `text/html`.

#### Scenario: User generates a sprint report

- **WHEN** the user selects a date range and one or more changes in the
  Sprint report mode and asks for the report
- **THEN** the report opens as a page in the product's own look, and the
  browser's print is offered for it

#### Scenario: User has not selected a range or any changes

- **WHEN** the user attempts to generate a report without a complete
  date range or without selecting any change
- **THEN** the system reports what is missing rather than attempting
  to generate an empty or partial report

