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

