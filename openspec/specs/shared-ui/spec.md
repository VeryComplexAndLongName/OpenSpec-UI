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

That predicate SHALL live in core, and every other list or tree that
narrows rows in either host SHALL use it. A rule that decides what a reader
can find is behaviour, not markup, and a second copy of it in a second host
is a second answer to "does this word match this change".

The predicate SHALL match on every whitespace-separated word of the query
independently, so a reader can narrow by part of a name and part of a state
in one breath.

#### Scenario: Searching in ChangesList

- **WHEN** a query is entered into `ChangesList`'s search box
- **THEN** only changes whose name or status label matches the query are
  rendered

#### Scenario: Searching in ArchiveList matches status too

- **WHEN** a query matching a status label (not a name) is entered into
  `ArchiveList`'s search box
- **THEN** matching changes are shown, in addition to the existing
  name-match and last-modified sort behavior

#### Scenario: One rule in both hosts

- **WHEN** the same words are typed into a list in the standalone shell and
  into a view in the editor
- **THEN** the same changes match, because both ask core the same question

#### Scenario: Two words

- **WHEN** a query holds two words that appear in different parts of a row
- **THEN** the row matches, and a row missing either word does not

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

This includes the variables of the component framework the shell uses.
Every variable its shipped rules read SHALL be set by the editor-theme
layer.

Where a token is a hue that carries text, the token SHALL declare the ink
used on it, and that pair SHALL meet WCAG AA. A hue SHALL NOT be used with
an ink other than the one declared with it.

#### Scenario: Changing the palette

- **WHEN** the palette is changed
- **THEN** it is changed in one place, and no rule keeps an older colour

#### Scenario: The editor-hosted surface

- **WHEN** the shell declares a token
- **THEN** the editor-theme layer defines that same token

#### Scenario: A framework variable

- **WHEN** a shipped rule of the component framework reads a variable
- **THEN** the editor-theme layer sets that variable

#### Scenario: A hue that carries text

- **WHEN** the palette declares a hue for a filled block that holds a label
- **THEN** it declares the ink used on that hue, and the pair meets WCAG AA

### Requirement: Separation is spent by role

Border, fill, radius and shadow each state that something is a separate
object, and SHALL be applied by role rather than uniformly.

Where every block carries the same border, radius and shadow, nothing is
emphasised: a heading, a navigation strip, a panel and a list row all
claim equal importance, and the reader is given no order to read them
in.

Shadow SHALL be reserved for what genuinely sits above the surface.

A block that is a separate object of its own — a named section of a form, a
figure standing beside other figures — MAY be drawn as a card or a panel. A
heading, a navigation strip and a list row SHALL NOT be.

#### Scenario: A page of mixed blocks

- **WHEN** a page shows a heading, a navigation strip, a panel and a
  list
- **THEN** they are not all drawn as the same object

#### Scenario: A named section of a form

- **WHEN** a form is made of named sections
- **THEN** a section may be drawn as a panel with its name in the panel's
  title, and the heading above the form is not drawn as one

### Requirement: The shell's own appearance stays out of a host editor

Where the shell is shown inside an editor, its colours SHALL come from
that editor's theme rather than from the shell's own palette.

A tool that repainted its own panel inside somebody's editor would
override a choice that is theirs.

That holds for every theme the editor can have, including dark,
high-contrast and third-party themes. The shell's dark palette SHALL be
selected by the class the editor puts on the page, and no literal colour
SHALL be written for the editor.

#### Scenario: The same screen in two places

- **WHEN** a screen is shown standalone and inside an editor
- **THEN** the standalone one uses the shell's palette and the hosted
  one follows the editor's theme

#### Scenario: A high-contrast theme

- **WHEN** the editor's theme is a high-contrast theme
- **THEN** the hosted screen's controls take their colours and borders
  from that theme

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

A survey SHALL read each working directory's active changes once, however
many task lists they hold, and SHALL NOT read the directory's archived
changes.

#### Scenario: A second working directory with changes of its own

- **WHEN** another working directory holds changes that this one does
  not
- **THEN** they are reported, with the branch they are on

#### Scenario: A directory that cannot be read

- **WHEN** one working directory cannot be read
- **THEN** it is reported as unreadable and the rest of the survey still
  appears

#### Scenario: A repository with hundreds of archived changes

- **WHEN** a survey is taken of three working directories, each with
  several active changes and hundreds of archived ones
- **THEN** each directory's active changes are read once, no archived
  change is read, and every change's task counts are reported as before

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

Where a card says that the same change is also worked in another
directory, the main checkout SHALL be named for what it is rather than by
its label. That label is the name of whichever folder the repository was
cloned into: it says nothing about the place, and may be read as something
else entirely - on this repository it is the product's own name. A
directory's own heading SHALL keep its own label, which is what a label is
for.

#### Scenario: A directory that declares nothing

- **WHEN** a working directory carries no declared label
- **THEN** it is named by its directory name

#### Scenario: A directory that declares a label

- **WHEN** a working directory declares a label
- **THEN** that label names it

#### Scenario: A change also worked in the main checkout

- **WHEN** a card in another working directory says where else its change
  is worked, and one of those places is the main checkout
- **THEN** it names it as the main working directory, not by the folder's
  name

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

A card SHALL draw only the lines of its text that fit whole, and SHALL NOT
draw part of a line.

A card's size SHALL be derived from what it holds, not measured after
drawing: its state, its progress, a waiting run's question, the facts it
draws, up to a fixed number, its controls, and, while it is open, its task
rows and headings.

Facts past that number SHALL remain available on the card to assistive
technology and in its full text, and the card SHALL show how many more there
are.

An open card SHALL be tall enough to draw every one of its task rows whole.

#### Scenario: More text than room

- **WHEN** a card has more facts than the number a card draws
- **THEN** the card draws that many whole, shows how many more there are,
  and keeps every fact available

#### Scenario: A busy card and a quiet one

- **WHEN** one card has a waiting run, four facts and controls, and another
  has only its state and progress
- **THEN** the first is taller than the second, and each draws every line
  whole

#### Scenario: An open card with many tasks

- **WHEN** a card with twenty tasks is open
- **THEN** every task row is drawn whole inside the card

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

Where the pull request reading failed, the reason SHALL name the cause
that `gh` gave. A refusal because no remote is on a GitHub host `gh` knows
SHALL NOT be stated as `gh` being signed out.

While the Changes list is shown, it SHALL read which runs are live again on
the interval the Pipeline reads the survey of working directories. It SHALL
lay those runs over the standings it holds by the same core function a
Pipeline card uses, and SHALL NOT read refs or pull requests again to do so.

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

#### Scenario: A remote that is not on GitHub

- **WHEN** `gh` refuses to list pull requests because no remote of the
  repository is on a GitHub host it knows, and `gh` is signed in
- **THEN** the list says pull requests were not read because no remote is on
  a GitHub host `gh` knows, and does not say `gh` is not signed in

#### Scenario: A run starts while the list is shown

- **WHEN** the Changes list is shown, and a run starts on a change after the
  list read its standings
- **THEN** within one survey interval the change's entry says Running, and
  its standing is not read again

#### Scenario: The survey cannot be read

- **WHEN** the list reads the survey again and the reading fails
- **THEN** every entry keeps the word it had

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

Where two of those readings each say which runs are live on a change, a card
SHALL take its state word and its run lines from the same one of them, so
that the word never says a change is idle beneath a line that says its run is
working.

#### Scenario: Two hosts, one change

- **WHEN** both hosts show the Pipeline for the same workspace at the same
  moment
- **THEN** each change's card states the same words in both

#### Scenario: One reading is a reading behind

- **WHEN** a run has started on a change, the survey of working directories
  has read its record, and the reading of where each change stands was taken
  before the run started
- **THEN** the card says Running above the run's activity line, and still
  states everything else that reading of where the change stands says

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

Each fact a card states SHALL be marked by its kind, and the mark SHALL be
decoration: the words SHALL state the fact on their own.

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

### Requirement: A card opens to list its change's tasks

A card SHALL offer to open and to close. An open card SHALL list its
change's tasks in the order of the change's task list, under that list's
section headings.

Each task SHALL state, in words, one of: done, in hand, probably next,
open, only a person can close it, or delegated to a named agent. At most
one task SHALL be in hand or probably next. Where a row draws a shorter tag
for its word, such as "A person" or the agent's name, the whole word SHALL
remain available on the row to assistive technology and in its full text.

Opening a card SHALL NOT change what any card says.

#### Scenario: Opening a card

- **WHEN** a reader opens a card whose change has six tasks under two
  headings
- **THEN** the card lists all six tasks under both headings, in the list's
  order, each with its state in words

#### Scenario: A delegated task

- **WHEN** a task is marked as delegated to an agent
- **THEN** its row names that agent

### Requirement: An open card's size is derived, not measured

Every card's height SHALL be derived from what it holds, open or closed, in
the same units as its position, and SHALL NOT be measured after drawing.

Each column SHALL place its cards one below another by their heights.
Opening a card SHALL move only the cards below it in its own column.

A line between cards SHALL meet a card at the card's head, which neither
opening the card nor what the card holds moves.

#### Scenario: Opening a card in a column of three

- **WHEN** the first of three cards in a column is opened
- **THEN** the other two move down by the open card's extra height, and no
  card in another column moves

### Requirement: The picture can be zoomed, and remembers how it was left

The picture SHALL offer to zoom in, to zoom out, and to reset the zoom. A
zoom SHALL scale the cards, their text and the lines together, so that
every line a card draws at one zoom it also draws whole at another.

The zoom, and which cards are open, SHALL be remembered for the viewer in
that host. A host that cannot store them SHALL still show the picture, with
the default zoom and every card closed.

#### Scenario: Zooming in

- **WHEN** a reader zooms the picture to 150%
- **THEN** every card and line is drawn larger, and no card cuts any line
  of its text

#### Scenario: Returning to the tab

- **WHEN** a reader opens a card, zooms, and later returns to the tab
- **THEN** that card is still open and the zoom is unchanged

### Requirement: A card offers Stop for another host's run only when a signature shows it is the asker's

A card for a run that another host started SHALL offer Stop only when the
run's record is verified as signed by the same enrolled person as this
host's own key.

Otherwise the card SHALL state whose the run is, or that it is not
verified, and SHALL NOT offer Stop.

Until the run's record shows that it read the request, the card SHALL say
that a stop was requested and is waiting to be read. The card SHALL NOT say
that the run refused.

#### Scenario: The person's own run in another working directory

- **WHEN** a run elsewhere is verified as signed by this host's person
- **THEN** its card offers Stop, asking for a reason

#### Scenario: Somebody else's run

- **WHEN** a run elsewhere is verified as signed by another person
- **THEN** its card names that person and offers no Stop

#### Scenario: A request not yet read

- **WHEN** a stop has been requested and the run's record does not yet show
  it
- **THEN** the card says the request is waiting to be read

### Requirement: The standalone shell follows the system theme, and remembers a choice

The standalone shell SHALL draw its dark palette when the system prefers
a dark appearance, and its light palette otherwise, until a person
chooses one with the header's theme control.

A choice SHALL be remembered in that browser, and SHALL win over the
system preference until changed. Where the choice cannot be read or
stored, the shell SHALL follow the system preference, and SHALL NOT fail.

Both palettes SHALL meet WCAG AA.

The control SHALL state its two states in its own role rather than by
renaming itself: its accessible name SHALL NOT change with the theme, and the
state SHALL be carried both by that role and by something a person can see
without words. It SHALL show no text label beside itself.

#### Scenario: A system set to dark

- **WHEN** the standalone shell opens with no stored choice, on a system
  that prefers dark
- **THEN** it draws the dark palette

#### Scenario: A remembered choice

- **WHEN** a person chooses light with the toggle, and opens the shell
  again on a system that prefers dark
- **THEN** it draws the light palette

#### Scenario: The control in either state

- **WHEN** the theme is light and again when it is dark
- **THEN** the control's accessible name is the same in both, and its state
  is announced by its role and shown by a glyph, with no words beside it

### Requirement: The component framework ships as a scoped copy of a pinned source

The component framework SHALL be vendored in the repository as its
published file, pinned by version and checksum, with its licence.

What ships SHALL be derived from that file by a build step that keeps only
the components the shell uses, and the framework's rules on the native
controls those components are drawn with.

That step SHALL scope every rule under the shell's own root. It SHALL keep
no rule on `body`, `html`, or any other bare element that is not such a
control, and no `*` outside a kept component. The derived copy SHALL sit
in a cascade layer beneath the shell's own rules.

The derived copy SHALL be committed, and a check SHALL fail when it differs
from what the step produces. Its size SHALL be stated and checked, so that
growth is read in review rather than discovered later.

Nothing the shell draws SHALL be fetched from another origin.

#### Scenario: A global rule in the framework

- **WHEN** the vendored framework contains a rule on `body`, `html`, `*`
  or a bare element that is not a native control
- **THEN** the shipped copy does not contain it

#### Scenario: A native control and the shell's own width

- **WHEN** a native field inside the shell's root is given a width by the
  shell, and the framework's rule for that field sets another
- **THEN** the field takes the framework's appearance and the shell's width

#### Scenario: A forgotten rebuild

- **WHEN** the vendored file or the kept-component list changes and the
  derived copy is not regenerated
- **THEN** a check fails and names the difference

#### Scenario: The derived copy grows

- **WHEN** a component family is added to the kept list
- **THEN** the stated size of the derived copy changes with it, and the
  check fails until the new figure is recorded

### Requirement: An icon is named for what it means, and comes from the pinned set

The shell MAY draw an icon beside a label, and SHALL take every icon from one
set derived from the pinned framework's own icons.

That set SHALL be generated by a build step from the pinned source, SHALL
carry only the glyphs the shell names, and SHALL be shipped inside the
stylesheet rather than fetched, so that a host restricting other origins draws
it.

A screen SHALL name what it means rather than a glyph, and one map SHALL turn
a meaning into the glyph that draws it.

An icon SHALL NOT be the only carrier of a meaning: it SHALL sit beside a
label, and SHALL be hidden from the accessible name.

#### Scenario: A screen asks for an icon

- **WHEN** a screen shows an action or a section that has an icon
- **THEN** it names the meaning, and the map gives the glyph

#### Scenario: A host that refuses another origin

- **WHEN** the shell is drawn inside a host that refuses fonts from another
  origin
- **THEN** its icons still draw

#### Scenario: A meaning with no glyph

- **WHEN** a screen names a meaning the map does not carry
- **THEN** a check fails and names it

#### Scenario: What a screen reader hears

- **WHEN** a screen reader reads a control that carries an icon
- **THEN** it reads the label, and the icon adds nothing to it

### Requirement: A card's state, progress and next step stand out

A card SHALL show its state word in a badge whose colour agrees with the
word, and SHALL NOT convey the state by colour alone. It SHALL show how many
of its change's tasks are done as a bar beside the count.

A card's controls SHALL be told apart by what they do: the control that moves
the change forward SHALL look different from a control that stops a run, and
both from a control that only copies. A control's accessible name SHALL NOT
change with its look.

Each column of the picture SHALL be headed by its place in the order, in
words true of every change in it whatever that change is doing: the first
column waits for nothing, and each other comes after the one before it. A
first column headed "can start now" read, over a change with every task
done, as advice to start it again (reported on 2026-09-23).

#### Scenario: A failed change beside a running one

- **WHEN** one change's last run failed and another's run is working
- **THEN** each card's badge carries its word, "Failed at verify" and
  "Running", in different colours, and each bar shows its tasks done

#### Scenario: A run waiting at a checkpoint on this host

- **WHEN** a run this host started waits to continue to verify
- **THEN** the card says so in a callout, "Continue to verify" is drawn as
  the forward control, and Stop is drawn as a stopping control

#### Scenario: Two columns

- **WHEN** one change waits on another
- **THEN** the first column is headed "Step 1 - waits for nothing", and the
  second "Step 2 - after step 1"

### Requirement: A legend says what a line between cards means

Where the picture draws a line between two cards, a legend SHALL state that
the line means the second card waits for the first, and that a collision is
written on the card and not drawn.

#### Scenario: A picture with a declared order

- **WHEN** a change is blocked by another in the picture
- **THEN** the legend states what the line between them means

### Requirement: A change says it is blocked wherever it is listed

Wherever a change is listed with its state, that state SHALL account for the
order the workspace declares: a change whose `blocked_by` names another that
is still active SHALL be stated as blocked, and SHALL name what blocks it.

The Change Graph, the readiness reading and the command line all read that
order. Two listings did not: they asked for a change's word without the
readiness fact, and the word every unfinished change fell through to was
Ready. Reported by DW on 2026-09-18, with a screenshot of one change marked
ready in the list and blocked in the graph at the same moment.

A listing and the picture of the same workspace SHALL NOT disagree about one
change, and a check SHALL read both rather than one.

Where a change's tasks are all ticked and a blocker is still active, both
facts SHALL be stated: the word stays the one the closed set gives a
finished change, and being blocked is stated with it.

#### Scenario: A change blocked by an active change

- **WHEN** a change declares `blocked_by` on another that has not archived,
  and nothing is running for it
- **THEN** every listing states it as blocked and names the blocker

#### Scenario: The blocker archives

- **WHEN** the change that blocked it archives
- **THEN** the listings stop stating it as blocked, without being asked to
  read again by hand

#### Scenario: Finished, and still blocked

- **WHEN** every task of a blocked change is ticked
- **THEN** the listing states that its tasks are done and that it is still
  blocked

#### Scenario: The listing and the picture

- **WHEN** one workspace is read for a listing and for the picture of the
  declared order
- **THEN** the two say the same about each change, and a check reads both

### Requirement: The Pipeline folds what has landed, and can be narrowed

The Pipeline SHALL fold away the cards whose change's work is over -
archived on the default branch, merged in a pull request, or gone from it
after being there - into one row stating how many, which opens them.

A picture of every change ever proposed is a wall. What the Pipeline is
for is what is being worked on now, and it already knows which changes are
over: the word on each card says so.

That row SHALL offer to archive those changes, and archiving SHALL happen
only on that press. Where one cannot be archived, the answer SHALL name it
and the rest SHALL still be archived.

The Pipeline SHALL take a filter over a change's name and its standing
word, using the same predicate every other narrowed view uses, and SHALL
say what it is filtered by and how many of how many it is showing. A
filter matching a change inside the folded group SHALL open that group for
the reading.

#### Scenario: Finished changes are folded

- **WHEN** the Pipeline draws a workspace where some changes have landed
- **THEN** those cards are folded into one row stating how many, and the
  rest are drawn as before

#### Scenario: Archiving what has landed

- **WHEN** the reader presses the row's archive
- **THEN** exactly the folded changes are archived, and one that cannot be
  is named while the rest are

#### Scenario: Narrowing the picture

- **WHEN** the reader filters the Pipeline
- **THEN** only the cards that match are drawn, the picture says what it
  is filtered by and how many of how many, and a match inside the folded
  group opens it

### Requirement: The Pipeline says how far behind this checkout is

The Pipeline SHALL say, above the picture, how many commits this
checkout's default branch is behind its remote and how many of the changes
it draws are archived on that branch, and SHALL offer to catch up.

Where the checkout is level with its remote, it SHALL say nothing: a line
that is always there is a line nobody reads.

A refusal from the catch-up SHALL be shown where the press was made.

A card of a change in another working directory SHALL say that the change
is archived on the default branch where the standings say so.

#### Scenario: A checkout behind its remote

- **WHEN** the default branch is behind its remote
- **THEN** the Pipeline says by how many commits, and how many of the
  changes drawn are archived on that branch

#### Scenario: A checkout level with its remote

- **WHEN** the branch is level
- **THEN** no such line is shown

#### Scenario: Catching up is refused

- **WHEN** the catch-up is pressed and core refuses it
- **THEN** the refusal is shown beside the press, and the picture is
  unchanged

#### Scenario: A change already archived, worked elsewhere

- **WHEN** a change in another working directory is archived on the
  default branch
- **THEN** its card says so

### Requirement: The Changes list says whose each change is

The Changes list SHALL say, for each active change, whether it is worked in
this working directory, in another one - named, and with the person where a
verified record names one - or by nobody, using the sentence
`packages/core` gives for that answer.

A change worked in another working directory SHALL be visibly distinct
from one this directory owns, and SHALL NOT be presented as ready to act
on.

#### Scenario: A change worked in another directory

- **WHEN** the list is drawn in a checkout where another working directory
  is a change's worktree
- **THEN** that change says where it is worked and who is working it, and
  is drawn distinctly from this directory's own change

### Requirement: The sprint report is a page of the product

`packages/webui` SHALL render a sprint summary as one complete HTML
document, drawn with the same stylesheets every other surface of this
product is drawn with, and carrying them inline so that the document can
be opened from a file with no server.

The document SHALL state the range, and for each change its author, its
dates, its task counts and its summary excerpt, and the totals with the
per-author breakdown - every figure the summary carries.

Every value that comes from the repository SHALL be escaped: a change
name, a commit author or a summary excerpt is text, never markup.

The document SHALL carry print rules, under which it has white paper, no
shadows, a page margin, and no single change split across a page break.

#### Scenario: A report opened from a file

- **WHEN** the document is opened with no server running
- **THEN** it is drawn in the product's own look, needing nothing else

#### Scenario: A change whose name contains markup

- **WHEN** a change's name, or an author's, contains characters that
  would be read as markup
- **THEN** they appear as the characters they are, and no markup is
  introduced

### Requirement: The Pipeline arranges its cards by stage

The Pipeline SHALL offer two arrangements of the same cards: by what each
change waits for, and as a board with a column per stage. The board SHALL
keep a column for every stage, empty or not, in the order Drafted,
Proposed, Planned, In progress, In review, Landed, Archived, each headed by that
stage's word. It SHALL draw no line between cards on the board, and report
no cycle there: what blocks a change is on its card, in either
arrangement.

The board SHALL be drawn whenever it is chosen, including where no change
stands on it at all, and SHALL then say why it is empty. A board whose
columns appeared only once something stood in them says nothing about the
way through, and a person who presses "By stage" and sees nothing cannot
tell a board with nothing on it from a control that does not work.

The board SHALL show a change that has landed, in its column. The other
arrangement folds those away, which is right where landing is not a place;
on a board Landed is a column, so folding empties it by construction and
hides the one thing the board exists to show.

**The board SHALL show every active change of the repository, wherever it
is worked**: this working directory's and every other working directory's,
one card per change. A change worked in two places SHALL stand on the
board once. A card for a change of another working directory SHALL say
which directory works it, and SHALL offer no action on it: a change is the
pair of a directory and a name, and nothing drawn here may reach the
change of that name in this checkout. Such a card SHALL NOT also be drawn
under the other working directories, which is where it stood before.

A board is of the work and not of one folder: one person with several
working directories has one flow of work, and splitting it by folder hides
the board's whole subject. The arrangement by declared order SHALL keep to
this checkout: an order is what this repository declares here, and another
directory's order is its own.

Each of the board's columns SHALL be separated from the next by a rule,
and SHALL carry, in its heading: the stage's word, a picture that stands
for that stage, how many changes stand in the column, and a colour of that
stage's own. The other arrangement SHALL carry none of these: its columns
are a sequence, and a rule there would assert a boundary nothing has.

The colour SHALL be a palette token named once, for every surface, and
each palette SHALL give that token a value - in the editor, from the
editor's own theme. Colour SHALL NOT be the only thing that carries the
distinction: the word is always there, and the picture agrees with it. The
count SHALL be readable by a reader who hears the heading rather than
seeing it.

The arrangement SHALL be offered only where the host reads the stages, and
SHALL be kept for the next visit with the zoom and the open cards.

#### Scenario: Switching to the board

- **WHEN** a person presses "By stage" on a Pipeline drawing a change that
  waits for another
- **THEN** the columns become the stages, and the line between the two
  cards is gone

#### Scenario: A board with nothing on it

- **WHEN** a person presses "By stage" where no change is drawn
- **THEN** every column is drawn, headed and empty, and the view says that
  every column is empty and why

#### Scenario: A change that has landed

- **WHEN** a change has landed and the board is chosen
- **THEN** its card stands in the Landed column rather than being folded
  away

#### Scenario: A change worked in another directory

- **WHEN** another working directory of this repository holds a change
  this checkout does not, and the board is chosen
- **THEN** its card stands in its own stage's column, says which directory
  works it, offers no action on it, and is not drawn again under the other
  working directories

#### Scenario: A change worked in two directories

- **WHEN** the same change is worked here and in another directory
- **THEN** one card stands on the board, this checkout's own

#### Scenario: A column's heading

- **WHEN** two changes stand in In progress and none in Proposed
- **THEN** the In progress heading carries its word, its picture, its own
  colour and the figure 2, and the Proposed heading carries the figure 0

#### Scenario: The rules between columns

- **WHEN** the board is drawn
- **THEN** a rule stands between each column and the next, and none before
  the first

#### Scenario: The other arrangement

- **WHEN** the arrangement by declared order is chosen
- **THEN** no rule, picture, colour or count is drawn on its headings, and
  the other working directories' changes are drawn under them as before

#### Scenario: A host that does not read the stages

- **WHEN** a host passes no reading of the stages
- **THEN** no arrangement is offered, and the picture is the declared
  order as before

#### Scenario: A change made before its proposal

- **WHEN** a change's directory holds no proposal and the board is chosen
- **THEN** its card stands in the Drafted column, and Start on it begins at
  propose

### Requirement: A card says where its change is and who holds it

Where the stages were read, every card SHALL say the stage its change is
in, how long it has been there, and its Owner and Implementer, in core's
words, in either arrangement.

#### Scenario: A change in review

- **WHEN** a change has been in review for four hours, owned by ada and
  implemented by bob
- **THEN** its card says "In review for 4h, ada owns it, bob implements
  it"

### Requirement: The board's last column holds what was archived

The Pipeline's board SHALL draw, in its Archived column, the changes this
repository archived most recently, and SHALL say how many more the archive
holds.

Without this the column is empty by construction and can never be
anything else: a change leaves `openspec/changes` when it is archived, and
the board draws from the active changes. A column that can never hold
anything says nothing about the way through.

What is drawn SHALL be bounded twice: by a window of days, and by a count.
A window alone follows the pace of the work - a week of this repository is
75 archived changes, which is a wall rather than a column - and a count
alone would show a quiet repository changes archived months ago. Whatever
is not drawn SHALL be counted in one line beneath the board.

The archive SHALL be read from the default branch on the server, so that
every machine that has fetched sees the same archive. Where that branch
cannot be read - no remote, never fetched - this working directory's own
archive SHALL be read instead, and the line beneath the board SHALL say
that is where it came from. Two people looking at "the" archive and
silently seeing different things is what naming the source prevents.

The day a change was archived SHALL be read from the name of its archived
directory, which carries it. Nothing else SHALL be read for it: no commit,
no blame, no forge. A directory whose name carries no date SHALL be left
out rather than dated by a guess.

A card in the Archived column SHALL say when its change was archived and
SHALL offer no action on it.

The arrangement by declared order SHALL draw none of this: it is the order
of what can still be run, and an archived change can run no more.

#### Scenario: What was archived lately

- **WHEN** the board is drawn and changes were archived within the window
- **THEN** each stands in the Archived column, saying the day it was
  archived, with no action offered

#### Scenario: A busy week

- **WHEN** more changes were archived within the window than the count
  allows
- **THEN** the newest are drawn up to that count, and the line beneath the
  board counts every one not drawn

#### Scenario: An archive read from this working directory

- **WHEN** the default branch cannot be read
- **THEN** this working directory's archive is drawn, and the line beneath
  the board says the count is as this working directory has it

#### Scenario: The other arrangement

- **WHEN** the arrangement by declared order is chosen
- **THEN** no archived change is drawn and no count of the archive is
  shown

### Requirement: A column's cards stand in the order the viewer picks

The Pipeline SHALL stack the cards within each column of its picture in
one of three orders, picked with a Sort control beside the arrangement:

- **Name**, the default: names compared as a person reads them, digits as
  numbers and case aside, so "change-2" stands before "change-10";
- **Progress**: the change with the largest share of its tasks done first;
- **Recently changed**: the change worked on last first, by the later of
  its task list's last change and its last run's end, or, archived, by
  the day it was archived.

A card without the fact an order compares SHALL stand after the cards that
have it. Cards equal in an order, and cards without its fact, SHALL stand
in name order.

The order SHALL apply within every column of both arrangements, and in the
pictures of the other working directories. It SHALL NOT move a card to
another column.

The order picked SHALL be kept with the zoom and the arrangement, and an
order the view does not know SHALL be read as Name.

Names compared as strings put "change-10" before "change-2", and a person
who numbers changes to find them faster found the column out of order.

#### Scenario: Numbered names

- **WHEN** a column holds "change-10", "change-2" and "change-1"
- **THEN** they stand as change-1, change-2, change-10

#### Scenario: By progress

- **WHEN** the viewer picks Progress, and one change has four of five
  tasks done, another one of five, and a third has no task list
- **THEN** the four-of-five change stands first and the one without a task
  list last

#### Scenario: By what was worked on last

- **WHEN** the viewer picks Recently changed, and one change's task list
  changed today while another's last run ended days ago
- **THEN** the change whose task list changed today stands first

#### Scenario: The order is kept

- **WHEN** the viewer picks Recently changed and opens the Pipeline again
- **THEN** the Sort control reads Recently changed and the columns stand in
  that order

### Requirement: A control that asks before it acts says so

A control SHALL end its visible words with three full stops, "...", where
pressing it asks for something before anything is done: a dialog to choose
in, a name, a pick, a filter, a reason, a file. This holds for a card's
buttons, for the standalone's buttons, and for the editor's command titles.
A control that acts at once, only shows something, opens a view, or asks
to confirm what was already chosen SHALL NOT carry them.

The dots SHALL be three full stops, never the single ellipsis character.

A control's accessible name SHALL NOT change with this: a card's Start is
still named "Start" and its change's name.

Every menu in the editor and the operating system follows this convention,
so a person reads "Start" as starting now; a Start that opens a dialog
instead was reported by a user on 2026-09-24.

#### Scenario: A card's Start

- **WHEN** a card offers Start, which opens the run dialog
- **THEN** it reads "Start...", and its accessible name is "Start" and the
  change's name

#### Scenario: A card's Stop

- **WHEN** a card offers Stop, which asks for a reason first
- **THEN** it reads "Stop..."; Stop now, which stops at once, reads "Stop now"

#### Scenario: A command that asks for a name

- **WHEN** the editor contributes Create Change, which asks for a name
- **THEN** its title is "OpenSpec Workbench: Create Change..."

#### Scenario: A command that only shows

- **WHEN** the editor contributes a command that opens a view or shows a
  result
- **THEN** its title carries no dots

