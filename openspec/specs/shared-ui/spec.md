# shared-ui Specification

## Purpose
One React component set for Changes/Archive/Specs/Tasks/AI panel that works
consistently over any transport, reused as-is in both standalone browser and
VS Code extension Webview.
## Requirements
### Requirement: Components are transport-agnostic
The system SHALL interact with `execution-core` only via the `Transport`
interface and SHALL NOT perform direct `fetch` or `postMessage` calls inside
view components. The system SHALL behave identically regardless of the
transport implementation provided at initialization.

#### Scenario: Switch transport implementation without component changes
- **WHEN** the same component tree is initialized first with `FetchTransport`
  and then with `MessageBridgeTransport`
- **THEN** components render equivalent output for equivalent data without code
  changes in the component layer

### Requirement: Change status comes from derived state, not UI logic
The system SHALL display change status
(`draft`/`in-progress`/`implemented`/`archived`) using the value computed by
`execution-core` and SHALL NOT implement status calculation logic in `webui`.

#### Scenario: Heuristic changes in execution-core
- **WHEN** change-state derivation logic changes in `execution-core`
- **THEN** `webui` display updates automatically without view-layer logic
  changes

### Requirement: Markdown editing is delegated to host when available
The system SHALL render spec/proposal markdown in read-only mode inside its
views and SHALL delegate editing to native host editor where available (VS Code
native editor in extension mode).

#### Scenario: User edits spec in VS Code extension
- **WHEN** user initiates spec-file editing in VS Code extension context
- **THEN** system opens the file in native VS Code editor, not inside Webview

### Requirement: AI panel uses one protocol independent of selected agent
The system SHALL provide one command-launch interface
(`plan`/`implement`/`review`) and one event-stream rendering approach
independent of selected CLI agent.

#### Scenario: Selected agent changes
- **WHEN** user switches selected agent from one CLI to another
- **THEN** command form and event rendering stay the same; only the underlying
  `AgentRunner` adapter changes

### Requirement: Changes and Archive lists share one search implementation

`ChangesList` and `ArchiveList` SHALL both filter their displayed changes
using the same predicate: a case-insensitive match against a change's
name or its human-readable status label. Neither component SHALL
implement its own, independently-maintained filter logic.

#### Scenario: Searching in ChangesList

- **WHEN** a query is entered into `ChangesList`'s search box
- **THEN** only changes whose name or status label matches the query are
  rendered

#### Scenario: Searching in ArchiveList matches status too

- **WHEN** a query matching a status label (not a name) is entered into
  `ArchiveList`'s search box
- **THEN** matching changes are shown, in addition to the existing
  name-match and last-modified sort behavior

### Requirement: Changes and Archive lists show task-completion percentage and last-modified date

`ChangesList` and `ArchiveList` SHALL both display a task-completion
percentage alongside a change's `completedTasks`/`totalTasks` fraction,
computed from the same shared formatting function so the two never
diverge. A change with zero total tasks SHALL NOT display a percentage
(distinct from a change with a positive total and zero completed tasks,
which SHALL show "(0%)"). Both components SHALL display a change's
`lastModified` date when present.

#### Scenario: A change with completed and pending tasks

- **WHEN** `ChangesList` or `ArchiveList` renders a change with a
  positive `totalTasks`
- **THEN** the rendered progress includes both the fraction and a
  rounded percentage

#### Scenario: A change with no tasks at all

- **WHEN** a change's `totalTasks` is zero
- **THEN** the rendered progress shows the fraction only, with no
  percentage

#### Scenario: ChangesList shows last-modified date

- **WHEN** `ChangesList` renders a change with a `lastModified` value
- **THEN** that date is displayed, matching `ArchiveList`'s existing
  behavior

### Requirement: Changes and Archive lists render inside a bounded, windowed scroll container

`ChangesList` and `ArchiveList` SHALL render inside a height-bounded
scroll container, independent of item count. Below a size threshold,
every item SHALL render as a real DOM row, identical to unbounded
rendering aside from the container. Above the threshold, only the
currently visible window of rows (plus a small overscan margin) SHALL
be mounted as real DOM nodes, with the full scrollable height preserved
so scrolling reveals the remaining rows correctly.

#### Scenario: A list below the threshold

- **WHEN** `ChangesList` or `ArchiveList` renders a number of items at
  or below the virtualization threshold
- **THEN** every item renders as a real DOM row inside the bounded
  scroll container

#### Scenario: A list above the threshold

- **WHEN** `ChangesList` or `ArchiveList` renders a number of items
  above the virtualization threshold
- **THEN** only the visible window of rows is mounted as real DOM
  nodes, and scrolling the container reveals further rows with correct
  content

#### Scenario: The search box stays reachable regardless of list size

- **WHEN** a list's content exceeds the bounded container's height
- **THEN** the list scrolls within its own container rather than
  pushing the search box (rendered above it) out of view

### Requirement: A running chain shows what it has spent

While a chain runs, the system SHALL show the resource usage its agents
have reported for that run, so that a person watching it can tell what
the work has cost without reading a log file.

The system SHALL show only figures an agent reported. Where a stage's
agent reported nothing, the system SHALL say so, and SHALL NOT show a
zero in place of an unreported figure.

Where reported costs are in different currencies, the system SHALL show
each currency separately and SHALL NOT convert between them.

#### Scenario: An agent reports usage during a chain

- **WHEN** a stage's agent reports usage
- **THEN** the running chain's display includes it

#### Scenario: A stage whose agent reported nothing

- **WHEN** a stage completes having reported no usage
- **THEN** the display says that stage reported nothing, rather than
  showing it as costing zero

#### Scenario: Costs in two currencies

- **WHEN** one stage reports a cost in one currency and another stage
  reports a cost in a different one
- **THEN** both are shown under their own currency and no combined
  figure is invented

### Requirement: Usage is attributed to the stage that spent it

The system SHALL attribute a chain's reported usage to the stage that was
running when it was reported, including the first stage and including a
stage during which the chain stopped.

To make this possible, a chain SHALL announce each stage when it begins,
not only when it ends.

#### Scenario: The first stage's usage

- **WHEN** the first stage of a chain reports usage, before any stage
  boundary has been reached
- **THEN** that usage is attributed to that stage

#### Scenario: A chain that stops during a stage

- **WHEN** a chain fails, is cancelled, or is refused at a ceiling while a
  stage is running
- **THEN** the usage that stage reported is attributed to it, and the
  stage is identified

### Requirement: A live figure is distinguished from a settled one

Where an agent reports figures continuously during a run, the system MAY
show them, and SHALL present them separately from the usage recorded for
completed runs.

The system SHALL NOT present a measure of context occupancy as an amount
consumed, and SHALL NOT include a live figure in a total that a
configured ceiling is compared against.

#### Scenario: An agent reporting continuously

- **WHEN** an agent reports its running cost and context occupancy during
  a stage
- **THEN** those figures are shown as the agent's live report, distinct
  from the usage recorded for finished stages

#### Scenario: Context occupancy

- **WHEN** an agent reports how much of its context window is in use
- **THEN** that figure is not added to any total presented as tokens
  consumed

### Requirement: A configured ceiling is legible against the recorded total

Where a spending ceiling is configured, the system SHALL show it beside
the recorded total it is compared against, and SHALL make clear that
reaching it stops the chain before the next stage rather than
interrupting the stage already running.

Where no ceiling is configured, the system SHALL NOT imply one exists.

#### Scenario: A configured ceiling

- **WHEN** a chain runs under a configured ceiling
- **THEN** the ceiling and the recorded total are shown together

#### Scenario: No ceiling configured

- **WHEN** a chain runs with no ceiling configured
- **THEN** usage is still shown, and nothing suggests a limit is in force

### Requirement: A run started in the AI panel can be cancelled from it

While a run started from the AI panel is in flight, the panel SHALL offer
a control that cancels it.

That control SHALL cancel the run that is in flight, identified by the run
it was started as, and SHALL NOT start a new one.

The control SHALL be offered only while a run is in flight.

This SHALL NOT depend on the autonomy level, because a single-stage run is
available at every autonomy level.

#### Scenario: Cancelling an in-flight run

- **WHEN** a run started from the AI panel is in flight and the cancel
  control is used
- **THEN** that run is cancelled

#### Scenario: No run in flight

- **WHEN** no run is in flight
- **THEN** the panel offers no cancel control

#### Scenario: The run ends between offering and using the control

- **WHEN** a run reaches a terminal outcome and the cancel control is used
  immediately afterwards
- **THEN** nothing is started, no error is reported, and the panel
  continues to show that run's terminal outcome

#### Scenario: A run that names no change

- **WHEN** a run that operates on no particular change is cancelled
- **THEN** it is cancelled the same way as a run that names one

### Requirement: Two controls on one screen do not share a name

Where the harness dispatch entry and the chain panel are visible
together, their controls SHALL be named distinctly.

They do different things — one resolves the configuration and decides
where the run goes, the other starts the chain — and a shared label makes
the choice between them unreadable. It is worse than an unclear name,
because clicking the wrong one is not visibly wrong: the dispatch entry
appears to do nothing when the panel it would reveal is already open.

#### Scenario: Both are on screen

- **WHEN** the chain panel is shown beneath the harness dispatch entry
- **THEN** the two buttons carry different labels, and the one that
  starts the chain says so

### Requirement: A field's name is bound to its own control

A form field's name SHALL be nearer to the control it names than to
anything above it, and SHALL be distinguishable from surrounding prose
by more than colour alone.

Colour alone is insufficient twice over: it is the distinction a reader
who cannot see it loses entirely, and it is the one that fails a
contrast requirement first.

Where a row consists of a name and its value and nothing else, the name
SHALL occupy its own column rather than a line above the value.

#### Scenario: Reading a stack of fields

- **WHEN** several fields are shown one under another
- **THEN** each name sits closer to its own control than to the field
  above it

#### Scenario: A name beside prose

- **WHEN** a field's name appears alongside explanatory text
- **THEN** the two are told apart by weight or placement, not only by
  colour

### Requirement: A control is sized to the value it holds

A control SHALL take a width from the kind of value it holds rather than
filling the width available.

A dropdown holding one word SHALL NOT span the page. Its indicator sits
at its own edge, so an over-wide control puts the indicator far from the
value it belongs to and makes the pointer cross the page to reach it.

#### Scenario: A one-word choice

- **WHEN** a dropdown offers a small set of one-word values
- **THEN** it is about as wide as those values, and its indicator is
  beside them

#### Scenario: A sentence-long choice

- **WHEN** a control's values are sentences
- **THEN** it is wide enough for them

### Requirement: A commit is separated from what it commits

A control that saves or applies a section SHALL be separated from that
section by more space than separates the fields within it.

Sitting flush against the last field, it reads as part of that field
rather than as the end of the group.

#### Scenario: Saving a section of settings

- **WHEN** a section of settings ends with the control that saves it
- **THEN** there is more space above that control than between the
  fields above it

### Requirement: Every colour the shell draws comes from a named token

The shell's stylesheet SHALL NOT contain colour literals in its rules.
Every colour SHALL be declared once as a custom property named for what
it is for, and referenced from there.

Each such token SHALL also be defined by the layer that maps the shell's
appearance onto a host editor's theme. A token defined in one layer and
not the other renders that host's surface with a missing value.

#### Scenario: Changing the palette

- **WHEN** the palette is changed
- **THEN** it is changed in one place, and no rule keeps an older colour

#### Scenario: The editor-hosted surface

- **WHEN** the shell declares a token
- **THEN** the editor-theme layer defines that same token

### Requirement: Separation is spent by role

Border, fill, radius and shadow each state that something is a separate
object, and SHALL be applied by role rather than uniformly.

Where every block carries the same border, radius and shadow, nothing is
emphasised: a heading, a navigation strip, a panel and a list row all
claim equal importance, and the reader is given no order to read them
in.

Shadow SHALL be reserved for what genuinely sits above the surface.

#### Scenario: A page of mixed blocks

- **WHEN** a page shows a heading, a navigation strip, a panel and a
  list
- **THEN** they are not all drawn as the same object

### Requirement: The shell's own appearance stays out of a host editor

Where the shell is shown inside an editor, its colours SHALL come from
that editor's theme rather than from the shell's own palette.

A tool that repainted its own panel inside somebody's editor would
override a choice that is theirs.

#### Scenario: The same screen in two places

- **WHEN** a screen is shown standalone and inside an editor
- **THEN** the standalone one uses the shell's palette and the hosted
  one follows the editor's theme

### Requirement: The shell shows the order of the work as a picture

The shell SHALL provide a view that lays out every active change as a
node, positioned by its place in the declared `blocked_by` order, with
changes that block nothing and are blocked by nothing shown side by
side.

The view SHALL draw a relation only where the repository states one. A
declared blocker SHALL be drawn as a relation from the blocker to the
change it blocks.

The view SHALL be built only from facts already derived for the
readiness report, so that it and the terminal's report of the same
question cannot disagree.

#### Scenario: Changes in a declared order

- **WHEN** a change declares that it is blocked by another
- **THEN** it is placed after that change, and the relation is drawn

#### Scenario: Changes with no relation between them

- **WHEN** two changes declare nothing about each other
- **THEN** they are placed side by side, and nothing is drawn between
  them

#### Scenario: A cycle of declared blockers

- **WHEN** the declared blockers form a cycle
- **THEN** the changes in it are named as a cycle rather than placed,
  because a cycle has no place in an order

### Requirement: A node says what state its change is in, and who is running it

Each node SHALL state whether its change is running, ready to start, or
blocked.

A change SHALL be running in either of these cases:

- a mutating run holds the working directory that belongs to the change;
- a run's status record that is not past the staleness window names the
  change from this working directory or from the change's own working
  directory.

A record that names the change from any other working directory SHALL NOT
make the change running.

A running change SHALL name where it is running. Where a lease recorded
the git author of the run, the node SHALL name that author, as attribution:
described as a git author, and never as an established identity. Where only
a status record says the change is running, the node SHALL claim nothing
about who is running it.

A blocked change SHALL name what it is waiting on. A change that is ready
SHALL name what it can be started alongside.

#### Scenario: A change being implemented

- **WHEN** a run holds a change's working directory and its lease
  recorded a git author
- **THEN** the node says the change is running and names that author

#### Scenario: A run whose lease recorded no author

- **WHEN** a run holds a change's working directory and no git identity
  was recorded
- **THEN** the node says the change is running, and claims nothing about
  who is running it

#### Scenario: A run that holds no lease

- **WHEN** a live status record names a change from this working
  directory, and no lease is held for that change
- **THEN** the node says the change is running there, and claims nothing
  about who is running it

#### Scenario: A copy of the change somewhere else

- **WHEN** a live status record names the change from a working directory
  that is neither this one nor the change's own
- **THEN** that record does not make the change running

#### Scenario: A run that stopped reporting

- **WHEN** the only record naming the change is past the staleness window
- **THEN** that record does not make the change running

### Requirement: A collision is shown on the change it affects, not as a relation

Where two changes cannot be started together, the view SHALL show that
on the changes affected, naming the other change and the reason.

It SHALL NOT draw a collision as a relation between them. A collision is
not an order, and a drawn relation would assert one that the repository
does not contain.

#### Scenario: Two ready changes that would collide

- **WHEN** two changes are both ready and would collide
- **THEN** each says it cannot be started alongside the other, and why,
  and nothing is drawn between them

### Requirement: The picture says how current it is

The view SHALL re-read while it is being looked at, and SHALL NOT
re-read while it is not.

It SHALL show when it last read, so that a picture is never presented as
more current than it is.

#### Scenario: The view is not being looked at

- **WHEN** another view is active
- **THEN** the picture is not re-read

#### Scenario: A change starts running while the view is open

- **WHEN** a run takes a change's working directory while the view is
  active
- **THEN** the next read shows that change as running

### Requirement: A suggestion is shown by one component in both hosts

Where a host shows what the repository suggests, it SHALL render it with
the shared component, from the payload the shared client already
fetches, and SHALL NOT compute a suggestion of its own.

A suggestion computed in a host exists in that host only, cannot be
printed by the command line, and cannot be tested without starting that
host — the same reasoning ADR 0001 gives for keeping behaviour in the
core package.

A suggestion SHALL be shown with its reason and its commands as text a
person can select and copy. It SHALL NOT be shown with a control that
runs those commands: a suggestion that acts is no longer a suggestion,
and nothing in this capability writes to a repository.

Where there is nothing to suggest, nothing SHALL be shown — not an empty
region with a heading.

#### Scenario: A host renders suggestions

- **WHEN** the payload carries suggestions
- **THEN** each is shown with its subject, its reason and its commands
  as selectable text, by the shared component in either host

#### Scenario: Nothing to suggest

- **WHEN** the payload carries no suggestion
- **THEN** the host shows nothing in their place

### Requirement: Every working directory of the repository is surveyed

The tool SHALL report every working directory of the repository it was
opened on, not only the one it was pointed at.

For each, it SHALL report the branch that directory has checked out, the
changes in that directory's own queue, how far each of those changes has
got, and, where a mutating run holds it, who holds it.

A directory that cannot be read SHALL be reported as unreadable, and
SHALL NOT remove the others from the survey.

#### Scenario: A second working directory with changes of its own

- **WHEN** another working directory holds changes that this one does
  not
- **THEN** they are reported, with the branch they are on

#### Scenario: A directory that cannot be read

- **WHEN** one working directory cannot be read
- **THEN** it is reported as unreadable and the rest of the survey still
  appears

### Requirement: A surveyed directory shows what its runs say they are doing

For each working directory, the survey SHALL show what each run reporting
there says it is doing: its change, its stage, its activity, and how long
since it said so. These SHALL be read from the status records that runs
already write.

Where a run has said which task it is on, or was started for one task,
the survey SHALL name that task by its number and text, and SHALL say
which of the two applies. A task number that names no task of the run's
change SHALL NOT be shown.

Where a run is waiting at a checkpoint or for a permission, the survey
SHALL say that it is waiting and what for, and SHALL NOT describe it as
running a stage.

A run whose record is past the staleness window SHALL be shown as gone.

A directory where no run reports SHALL be described as such, and SHALL
NOT be described as idle: a session this product did not start writes no
record.

No verdict about a run's health SHALL be stated.

Reading the records SHALL NOT run git against any working directory beyond
the one enumeration the survey already makes.

#### Scenario: A run in another working directory

- **WHEN** a run in another working directory reports an activity
- **THEN** the survey shows that activity under that directory, with how
  long ago it was said

#### Scenario: A directory no run reports from

- **WHEN** no status record names a working directory
- **THEN** the survey says that no run reports there, and does not call
  the directory idle

#### Scenario: A record for a directory that is gone

- **WHEN** a status record names a path that is no longer a working
  directory of the repository
- **THEN** the record is reported as belonging to no directory, and is not
  dropped

#### Scenario: A run that said which task it is on

- **WHEN** a run's record says it is on task 1.2 by its own account, and
  the change's list has a task 1.2
- **THEN** the survey names task 1.2 with its text, and says the run said
  so

#### Scenario: A run that named a task its change does not have

- **WHEN** a run's record names task 9.9 and the change's list has no such
  task
- **THEN** the survey names no task for that run

#### Scenario: A run waiting at a checkpoint

- **WHEN** a run's record says it is waiting to continue to the next
  stage
- **THEN** the survey says the run is waiting, and does not say it is
  running a stage

### Requirement: Another directory's changes cannot be acted on

A change belonging to another working directory SHALL carry no action:
it SHALL NOT be openable, runnable, or modifiable from here.

A change SHALL be identified by its working directory together with its
name, never by name alone, so that no action can reach a change of the
same name in a different directory.

Recessed or otherwise quietened presentation SHALL NOT be the only thing
that makes it unmodifiable.

#### Scenario: A change belonging to somebody else's directory

- **WHEN** a change from another working directory is shown
- **THEN** nothing offers to open, run, or change it

#### Scenario: One name in two directories

- **WHEN** two working directories each hold a change of the same name
- **THEN** each is shown under its own directory, and neither can be
  acted on through the other

### Requirement: A working directory is labelled, and the label is not an identity

Each working directory SHALL carry a label.

Where the directory declares none, its own directory name SHALL be used,
so that a directory that declares nothing is still named.

The label SHALL be reported as self-declared. Nothing SHALL be permitted
or refused on the strength of it.

#### Scenario: A directory that declares nothing

- **WHEN** a working directory carries no declared label
- **THEN** it is named by its directory name

#### Scenario: A directory that declares a label

- **WHEN** a working directory declares a label
- **THEN** that label names it

### Requirement: A run by a different git author is distinguished

Where a working directory is held by a run whose recorded git author
differs from this checkout's own configured identity, the survey SHALL
say so.

It SHALL be said in words. Colour MAY agree with those words and SHALL
NOT be the only thing that carries the distinction.

The label and the git author SHALL be reported as the separate facts
they are; neither SHALL stand in for the other.

#### Scenario: Another person's run

- **WHEN** a directory's lease records a git author other than this
  checkout's
- **THEN** the survey says so in words

#### Scenario: Several directories, one person

- **WHEN** every directory records the same git author
- **THEN** none is distinguished as another person's, and each is still
  named by its own label

### Requirement: A reading names the branch it came from

The tool SHALL name the branch each reading was taken from.

An empty queue SHALL therefore be distinguishable from a reading taken
somewhere other than where the reader expected.

#### Scenario: A checkout with no active changes

- **WHEN** the directory being read has no active changes
- **THEN** it says so and names the branch it read

### Requirement: Nothing from another directory enters this one's order

Changes belonging to another working directory SHALL be laid out against
that directory's own queue, and SHALL NOT be placed in this one's order.

No relation SHALL be drawn between changes in different working
directories. The repository declares no order between them, and a drawn
relation would assert one.

#### Scenario: Two directories with unrelated changes

- **WHEN** two working directories each hold changes
- **THEN** each set is laid out on its own, and nothing is drawn between
  them

### Requirement: A change present in more than one directory is reported

Where one change exists in more than one working directory, the survey
SHALL report it.

It SHALL NOT be refused, prevented, or resolved: it arises from ordinary
branching, and becomes a conflict only if a copy is edited.

#### Scenario: A change inherited by a new working directory

- **WHEN** a change exists in two working directories at once
- **THEN** the survey reports that it does, and both continue to be
  shown

### Requirement: Each reading is shown when it arrives

The picture of the other working directories SHALL be shown whether
this directory's own reading is still being taken, has arrived, or has
failed.

#### Scenario: This directory is still being read

- **WHEN** the other working directories have been read and this
  directory's reading has not arrived
- **THEN** the other working directories are shown, beside a note that
  this directory is still being read

#### Scenario: This directory could not be read

- **WHEN** this directory's reading fails and the other working
  directories were read
- **THEN** the failure is shown, and so are the other working directories

### Requirement: A card shows only whole lines of its text

A card of fixed size SHALL draw only the lines of its text that fit
whole, and SHALL NOT draw part of a line.

Which lines fit SHALL be derived from the card's size, not measured
after drawing.

Lines that do not fit SHALL remain available on the card to assistive
technology and in its full text, and the card SHALL show that there is
more.

#### Scenario: More text than room

- **WHEN** a card's text has more lines than its size holds
- **THEN** the card draws the lines that fit whole, shows that there is
  more, and every line remains available

### Requirement: An age on the picture keeps counting between readings

How long ago a run said something, and how long ago it was last heard
from, SHALL be counted from the times the run's record carries. It SHALL
NOT stay at the value measured when the picture was read.

Counting SHALL NOT read anything.

#### Scenario: A minute between readings

- **WHEN** a run said something 10 seconds before a reading, and 40
  seconds pass with no new reading
- **THEN** the picture says the run said it about 50 seconds ago

### Requirement: A host may tell the picture when to read

Where a host signals that what the picture reads has changed, the picture
SHALL read on that signal, and on a slow interval as a backstop, instead
of on its own shorter clock.

Where a host gives no signal, the picture SHALL read on its own clock, as
before.

#### Scenario: A host that signals

- **WHEN** the host signals that the survey has changed
- **THEN** the survey is read, and the readiness report is not

#### Scenario: A host that does not signal

- **WHEN** the host gives no signal
- **THEN** the picture reads on its own interval

### Requirement: A form's sections are separated from each other

Where a form has more than one section, the end of each section, including
the control that saves or applies it, SHALL be separated from the next
section's heading by more space than separates the fields within a section.

Without that separation, the heading of the next section reads as if it
belonged to the save control above it.

#### Scenario: Two sections, one after the other

- **WHEN** a section ending in its save control is followed by another
  section
- **THEN** the gap between that control and the next heading is larger
  than the gap between two fields

### Requirement: A save is offered when there is something to save

A control that saves a settings form SHALL be enabled only while the form
differs from what was last loaded, applied or saved. While it differs, the
form SHALL say that it has unsaved changes.

#### Scenario: Nothing changed

- **WHEN** a settings form has just been loaded
- **THEN** its save control is disabled

#### Scenario: A field changed

- **WHEN** a field is changed
- **THEN** the save control is enabled, and the form says it has unsaved
  changes

### Requirement: A change is drawn once, beside the worktree that belongs to it

Where a working directory is the one that belongs to a change of this
working directory, the part of the picture showing the other directories
SHALL NOT draw that change again inside it, and SHALL say that the
directory belongs to that change.

That directory's other changes, its branch and its runs SHALL still be
shown.

#### Scenario: A change with its own worktree

- **WHEN** a change of this working directory has a worktree of its own
- **THEN** the change is drawn once, and that worktree is described as
  belonging to it

#### Scenario: A worktree that inherited other changes

- **WHEN** a change's own worktree also holds other changes
- **THEN** those other changes are still drawn under that worktree

### Requirement: A surveyed run says whose it is, as far as its signature shows

For each run, the survey SHALL state whether the run's record is verified,
unverified, or does not check out.

A verified run SHALL be described as signed by the enrolled person, and
nothing more SHALL be claimed about the run itself.

A run whose record does not check out SHALL be described as such, with
nothing from its contents.

#### Scenario: A verified run

- **WHEN** a run's record is verified
- **THEN** the survey says the run is signed by the enrolled person

#### Scenario: A record that does not check out

- **WHEN** a run's record does not check out
- **THEN** the survey says so, and shows no activity for that run

### Requirement: An enrolment request waits where items wait on a person

The standalone shell SHALL show each enrolment request beside the items that
wait on a person, with its label, working directory, machine, git author and
time. It SHALL offer one action that confirms the person started the run.

#### Scenario: A request in the shell

- **WHEN** a key awaits enrolment
- **THEN** the shell's inbox shows the request with those facts, and one
  action confirms it

### Requirement: A change's list entry says where the change stands

The Changes list SHALL show, for each change, one word that says where the
change stands across the repository, derived in `packages/core` from:

- this checkout's copy;
- every working directory's copy;
- the repository's main branch;
- the change's own branch;
- where it can be read, the branch's pull request.

The word SHALL come from the one closed set of state words that every
surface uses:

- Running, or running in a named directory;
- Waiting for you, or waiting in a named directory;
- Archived on main;
- Merged in a numbered pull request;
- Deleted on main;
- Further along in a named directory or on a named branch;
- Failed at a stage;
- Stopped at a stage;
- Done;
- Blocked;
- Ready.

The first word that applies, in that order, SHALL be shown. Whatever else
applies SHALL be stated in lines beneath it, each naming its source.

A colour SHALL agree with the word, and SHALL NOT be the only way the state
is shown.

The list SHALL state which ref was read as the main branch, when the
repository's refs were last fetched, and whether the last fetch or the
pull request reading failed.

#### Scenario: A change archived on main

- **WHEN** a change is active in this checkout and archived on the main
  branch
- **THEN** its entry says "Archived on main", with a colour that agrees

#### Scenario: A change further along elsewhere

- **WHEN** another working directory's copy of a change has more tasks done
  than this checkout's copy
- **THEN** the entry says the change is further along there, and gives both
  counts and that directory's label

#### Scenario: Refs that could not be refreshed

- **WHEN** the last fetch failed
- **THEN** the list says so and when refs were last fetched, and still shows
  every standing it could read

### Requirement: Every surface shows a change the same way

The Changes list, the VS Code Changes tree, a Pipeline card and the
terminal SHALL show the same state word, the same lines and the same colour
role for a change. They SHALL obtain them from one function in
`packages/core`, and none of them SHALL derive a change's state itself.

#### Scenario: One change on two surfaces

- **WHEN** a change is archived on the main branch and ready in this
  checkout
- **THEN** the Changes list and the change's card both say "Archived on
  main", with "Ready" as a line beneath it, in the same colour role

### Requirement: A person can refresh a change's state now

The Changes list and the Pipeline SHALL offer a Refresh control. It SHALL
read every change's files again and fetch the repository's refs at once,
and then state when refs were last fetched.

While a fetch is under way the control SHALL say so and SHALL NOT start a
second one. A failed fetch SHALL be stated beside it.

#### Scenario: A pull request merged a moment ago

- **WHEN** a change's pull request was merged after the last fetch, and the
  person presses Refresh
- **THEN** the change's word becomes "Merged" and the line saying when refs
  were last fetched shows the new time

#### Scenario: Refresh pressed twice

- **WHEN** the person presses Refresh again while its fetch is under way
- **THEN** no second fetch starts

### Requirement: The run dialog asks before starting a change that stands elsewhere

The run dialog SHALL lead with the change's standing, read after a fresh
fetch. Where the change is running elsewhere, archived on the main branch,
merged, or deleted on the main branch, every path SHALL stay disabled until
the person confirms that they want to start it anyway.

The dialog SHALL NOT refuse the run.

#### Scenario: Starting a change archived on main

- **WHEN** a person opens the run dialog for a change archived on the main
  branch
- **THEN** the dialog says so first, and no path can start until the person
  confirms

#### Scenario: Starting a change only here

- **WHEN** a person opens the run dialog for a change no other source has
- **THEN** the dialog starts it as before, with no confirmation

### Requirement: What a card says is derived in one place

A card's state, and every line a card states about its change, SHALL be
derived by one function in the core package, from the readings the host
already takes.

A host SHALL render what that function returns, and SHALL NOT derive any
part of it itself.

#### Scenario: Two hosts, one change

- **WHEN** both hosts show the Pipeline for the same workspace at the same
  moment
- **THEN** each change's card states the same words in both

### Requirement: A card states its change's state as one word from a closed set

A card SHALL state its change's state as the word the one closed set
every surface uses gives for it:

- Running, or running in a named directory;
- Waiting, or waiting in a named directory;
- Archived on main;
- Merged in a numbered pull request;
- Deleted on main;
- Further along elsewhere;
- Failed at a stage;
- Stopped at a stage;
- Done;
- Blocked;
- Ready.

A card SHALL take that word from the same core function the Changes views
use, so a card and the Changes views never show a change differently.

What is happening now SHALL outrank what has been settled elsewhere; that
SHALL outrank where the work is ahead elsewhere; that SHALL outrank how the
last run ended; and how the last run ended SHALL outrank what could happen
next.

A run's ending SHALL decide the state only while the change's task list is
unchanged since that run ended.

A stop asked for by a person SHALL be stated as Stopped, and never as
Failed. A stop by a configured limit SHALL be stated as Stopped, naming the
limit.

A waiting run SHALL be stated as Waiting, with what it waits for and in
which working directory.

#### Scenario: A run under way

- **WHEN** a run is under way for the change and is not waiting
- **THEN** the card says Running, with the run's stage and activity and how
  long ago the run said so

#### Scenario: A run waiting at a checkpoint

- **WHEN** the change's run is waiting to continue to its next stage
- **THEN** the card says Waiting, names the next stage, and names the
  working directory the run is in

#### Scenario: A failure with nothing since

- **WHEN** the change's latest run failed at apply, nothing is running, and
  the task list has not changed since
- **THEN** the card says Failed at apply

#### Scenario: A failure older than the task list

- **WHEN** the change's latest run failed, and its task list changed after
  that run ended
- **THEN** the card does not say Failed, and still states how the last run
  ended

#### Scenario: A person stopped the run

- **WHEN** the change's latest run was cancelled at verify with no rule
  given as the reason
- **THEN** the card says Stopped at verify

#### Scenario: Every task ticked

- **WHEN** every task of the change is ticked, and nothing is running
- **THEN** the card says Done

### Requirement: A card names the task in hand, or says it is guessing

Where a run's record names a task that the change's list has, the card
SHALL name that task, and SHALL say whether the run said so or was given
the task.

Where a run is under way and names no task, the card SHALL name the first
open task that an agent may do, and SHALL say that this is a guess.

A task that only a person, or only another agent, may close SHALL NOT be
offered as the guess.

#### Scenario: The run said which task

- **WHEN** a run's record says the run is on task 2.3 by its own account
- **THEN** the card names task 2.3, with its text, and says the run said so

#### Scenario: The run said nothing about its task

- **WHEN** a run is under way and its record names no task, and the first
  open task is 2.4
- **THEN** the card names task 2.4 and says that this is probably the task
  in hand

#### Scenario: The first open task is a person's

- **WHEN** the first open task is marked as one only a person can close,
  and the next open task is 2.5
- **THEN** the guess names task 2.5

### Requirement: A card states progress, the last run, and where its facts came from

A card SHALL state how many of its change's tasks are done, out of how many,
and how many open items only a person, or only another agent, can close.

A card SHALL state how the change's latest run ended, at which stage, and
how long ago. It SHALL state what the run cost where a cost was reported,
and SHALL NOT state a cost that was not reported.

A card SHALL name the working directory and the branch its facts were read
from.

#### Scenario: A run whose agent reported no cost

- **WHEN** the change's latest run recorded no usage
- **THEN** the card states how the run ended, and states no cost

#### Scenario: A change with its own worktree

- **WHEN** a change has a worktree of its own
- **THEN** its card states the task progress read from that worktree, and
  names that worktree and its branch

### Requirement: A card starts its change through the run dialog

A card whose change can start SHALL offer Start. Start SHALL open the run
dialog for that change, and SHALL NOT start a run by itself.

A card whose change cannot start SHALL NOT offer Start.

#### Scenario: A ready change

- **WHEN** Start is used on the card of a ready change
- **THEN** the run dialog opens for that change, and no run starts until a
  path is chosen in it

#### Scenario: A blocked change

- **WHEN** a change is blocked
- **THEN** its card offers no Start

### Requirement: A run this host started is answered and stopped from its card

Where a change's run was started by the host that shows the card, the card
SHALL:

- say "Waiting for you" while the run waits, and offer to answer it;
- offer Stop, and ask for a reason;
- once a stop has been asked, offer Stop now, which terminates the run.

Where the run was started elsewhere, the card SHALL offer none of these. A
waiting run SHALL be described as answered where it was started. The card
SHALL show the folder the run was started in and offer to copy its path, and
SHALL NOT offer to open that folder.

#### Scenario: A checkpoint on this host's run

- **WHEN** a run this host started waits at a checkpoint
- **THEN** its card says "Waiting for you" and offers to continue or to stop

#### Scenario: Asking a run to stop

- **WHEN** Stop is used on a card and a reason is given
- **THEN** the run is asked to stop, the card says it was asked and why, and
  the card offers Stop now

#### Scenario: A run another host started

- **WHEN** a card's run was started by another host
- **THEN** the card offers no answer and no stop, and offers to copy the
  path of the folder the run was started in

