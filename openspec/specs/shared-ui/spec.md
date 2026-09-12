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

A running change SHALL name where it is running and, where the lease
recorded one, the git author of the run — as attribution, described as
a git author and never as an established identity.

A blocked change SHALL name what it is waiting on. A change that is
ready SHALL name what it can be started alongside.

#### Scenario: A change being implemented

- **WHEN** a run holds a change's working directory and its lease
  recorded a git author
- **THEN** the node says the change is running and names that author

#### Scenario: A run whose lease recorded no author

- **WHEN** a run holds a change's working directory and no git identity
  was recorded
- **THEN** the node says the change is running, and claims nothing about
  who is running it

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

