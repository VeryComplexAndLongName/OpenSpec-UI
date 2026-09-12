# openspec-workbench Specification

## Purpose

Define integrated OpenSpec workspace navigation, lifecycle control, native VS
Code AI workflows, process visibility, and conflict-safe rollback.
## Requirements
### Requirement: Workbench exposes the complete OpenSpec workspace

The system SHALL provide hierarchical navigation to configuration, active and
archived changes, canonical specs, and proposal, design, tasks, and delta spec
artifacts without requiring users to locate files manually. When the Processes
dashboard opens from VS Code, it SHALL initialize its workspace and change
paths from the current host context and SHALL use VS Code semantic theme colors.

#### Scenario: User expands an active change

- **WHEN** the user expands a change in the Workbench
- **THEN** proposal, design, tasks, and delta specs are shown
- **AND** selecting an artifact opens it in a native VS Code editor

#### Scenario: A collection does not exist

- **WHEN** archive or canonical specs have not been created
- **THEN** the view explains why it is empty
- **AND** offers an applicable lifecycle or documentation action

#### Scenario: User opens the Processes dashboard from Changes

- **WHEN** the user invokes Open Process Dashboard from the Changes view title
- **THEN** Workspace root contains the active VS Code workspace path
- **AND** Change directory contains that workspace's `openspec/changes` path

#### Scenario: Existing dashboard receives new context

- **WHEN** the dashboard is already open and is revealed for another change
- **THEN** its workspace and change-directory fields update to the supplied host
  context
- **AND** stale local-storage values do not override the host context

#### Scenario: VS Code color theme changes

- **WHEN** VS Code renders the dashboard in a light, dark, high-contrast, or
  custom color theme
- **THEN** dashboard surfaces, text, controls, borders, and focus indicators use
  VS Code semantic theme variables
- **AND** the standalone browser palette is unchanged

### Requirement: Users control the complete change lifecycle

The system SHALL support create, edit, validate, archive, unarchive, and guarded
delete workflows while keeping OpenSpec and repository files as the source of
truth.

#### Scenario: User archives a valid completed change

- **WHEN** the user previews and confirms archive
- **THEN** core invokes the deterministic OpenSpec archive operation
- **AND** active, archived, and canonical spec views refresh

#### Scenario: User requests a destructive operation

- **WHEN** the user requests delete, unarchive, or rollback
- **THEN** the Workbench shows the affected paths or diff
- **AND** no mutation occurs without explicit confirmation

### Requirement: Workbench visualizes concurrent processes

The Workbench SHALL visualize queued, running, completed, failed, cancelled,
interrupted, and rolled-back processes with operation, target change, progress,
and result details. It SHALL permit concurrent read-only operations but SHALL
serialize all workspace mutations until independent filesystem isolation is
available.

#### Scenario: Independent changes run concurrently

- **WHEN** a mutating operation is active for one change
- **AND** read-only operations are requested for independent changes
- **THEN** the read-only operations may execute concurrently
- **AND** each process is displayed independently

#### Scenario: Conflicting mutation is requested

- **WHEN** one mutating process is active and another mutation is requested for
  the same workspace
- **THEN** the second process is shown as queued
- **AND** it starts only after the active mutation reaches a terminal state

#### Scenario: Process history is restored

- **WHEN** the Workbench host reloads
- **THEN** persisted terminal processes remain visible
- **AND** unfinished processes are shown as interrupted rather than running

### Requirement: AI workflows use explicit native VS Code Chat integration

The system SHALL register an OpenSpec Chat participant for plan, implement, and
review workflows, while direct OpenSpec commands remain available without AI.

#### Scenario: User starts implementation from Chat

- **WHEN** the user explicitly invokes the OpenSpec participant for a change
- **THEN** VS Code controls model selection and authorization
- **AND** the Workbench provides bounded repository context and typed actions
- **AND** repository content cannot grant additional tool or path permissions

#### Scenario: No language model is available

- **WHEN** the user invokes an AI workflow without an available model
- **THEN** deterministic lifecycle commands continue to work
- **AND** the Workbench presents a clear fallback instruction

### Requirement: Mutating runs support scoped rollback

Before an AI-assisted mutation, the Workbench SHALL create a bounded checkpoint
that preserves pre-run user state and records any omitted rollback coverage.
After completion or interruption, the Workbench SHALL calculate the run delta
and offer review and explicit rollback. Rollback SHALL restore only run-owned
changes and SHALL refuse to overwrite later conflicting edits.

#### Scenario: User rolls back an uncontested run

- **WHEN** affected files still match their post-run fingerprints
- **AND** the user reviews and confirms the affected file list
- **THEN** files are restored to their pre-run state
- **AND** the process is marked rolled back

#### Scenario: A file changed after the run

- **WHEN** an affected file no longer matches its post-run fingerprint
- **THEN** rollback refuses to overwrite it
- **AND** identifies the conflicting file for manual resolution

#### Scenario: Checkpoint coverage is partial

- **WHEN** files are omitted because of checkpoint limits or excluded directory
  policy
- **THEN** the process details identify that rollback coverage is partial
- **AND** the omitted paths or directory classes are available for inspection

#### Scenario: Interrupted run is rolled back after reload

- **WHEN** an implementation run is restored as interrupted with a finalized
  delta
- **AND** no affected file changed after recovery finalization
- **THEN** the user can explicitly restore the pre-run state

### Requirement: A change's task record states what has actually been done

A change's task record SHALL reflect the state of the repository. Work
that has shipped SHALL be recorded as done, and work that has not SHALL
NOT be.

A verification item SHALL be recorded as done only after it has been
carried out, never in the same act as the work it verifies.

Where an item can only be carried out by a person, it SHALL remain open
until that person has carried it out, and SHALL NOT be inferred from
related evidence.

#### Scenario: Work has shipped

- **WHEN** a change's implementation is present in the default branch
- **THEN** its task record shows that work as done

#### Scenario: A verification item has not been run

- **WHEN** a verification item's checks have not been carried out
- **THEN** it remains open, whatever the state of the work it verifies

#### Scenario: An item only a person can carry out

- **WHEN** an item is marked as requiring a person
- **THEN** it stays open until that person reports it done, and passing
  automated checks do not close it

#### Scenario: Partial evidence for a verification item

- **WHEN** part of what an item claims has been observed and part has not
- **THEN** the item stays open, rather than being closed on the observed
  part

### Requirement: A refused archive states the reason the tool gave

Where archiving a change is refused, the reason SHALL be reported as the
underlying tool stated it — naming the requirement or scenario at fault
where the tool named one.

The tool refuses precisely, and the refusal is the information a person
needs in order to act: which requirement drifted, which scenario would
have been dropped. Reporting only that the archive did not happen sends
the reader to run the command themselves to learn what the system already
knows.

Where the refusal carries more than one problem, all of them SHALL be
reported. Reporting the first sends the reader back round the loop for
the second.

Where no reason can be recovered, the report SHALL say that, rather than
presenting a runtime warning or an unparsed payload as the explanation.

#### Scenario: A stale spec delta is refused

- **WHEN** archiving is refused because a modified block no longer
  matches the specification
- **THEN** the reported reason names the requirement or scenario at fault

#### Scenario: Several problems at once

- **WHEN** a refusal carries more than one error
- **THEN** every one of them is reported

#### Scenario: Nothing usable was produced

- **WHEN** archiving fails with no recoverable reason
- **THEN** the report says no reason was given, rather than showing
  unrelated output as one

#### Scenario: Archiving succeeds

- **WHEN** a change archives normally
- **THEN** nothing about this reporting changes

### Requirement: Documentation screenshots are captured from a running product

A screenshot used in this repository's documentation SHALL be captured
from the running standalone UI by an end-to-end test, not taken by hand.

A hand-taken screenshot goes stale silently: the screen changes, the
picture does not, and nothing fails. One captured by a test fails when the
element it waits for is gone, so a screen that changed is reported rather
than quietly misrepresented.

This applies to the extension's documentation as well as the standalone
application's. A screen that is the shared web UI rendered inside a
webview is not an editor surface: it is reachable from the browser and
SHALL be captured there, whichever host a reader sees it in.

Where a surface cannot be driven this way — the editor's own tree views,
menus and quick-picks are not reachable from a browser — documentation
SHALL be written to stand without a picture of it, or SHALL carry one
that is explicitly listed as hand-taken, with the reason and the date it
was taken. An unlisted hand-taken picture SHALL NOT be used: the defect
is not that a picture was taken by hand, it is that nobody can tell
which pictures those are.

#### Scenario: A screen changes under a captured screenshot

- **WHEN** a screen a documentation screenshot depends on changes
- **THEN** the capture fails on the element it can no longer find, rather
  than producing a picture of the wrong screen

#### Scenario: A webview screen documented for the extension

- **WHEN** documentation for the VS Code extension shows a screen that
  the shared web UI renders
- **THEN** the picture is captured from the standalone shell by an
  end-to-end test

#### Scenario: An editor-native surface

- **WHEN** a documented surface is drawn by the editor itself
- **THEN** either the documentation stands without a picture, or the
  picture is listed as hand-taken with its reason and the date it was
  taken

### Requirement: A change is dated by evidence, and each date says where it came from

A change SHALL carry the dates it can be dated by — when it was
proposed, when it was first worked on, when it was last worked on, and
when it was archived — and each SHALL carry the source it was read from.

A date read from a commit and a date read from a directory name are
different claims. Presented alike they plot alike, and the one that
survives someone renaming a directory is not the one that looks the
same.

The day a date falls on SHALL be the day where the action happened, as
its record states it, whichever source it was read from. A commit made
at half past two in the morning in one timezone is that day to the
person who made it and to the directory the archive named; a reading
that moves it to the previous day for one source and not the other
makes the two sources disagree about one action.

Evidence that work happened SHALL be a task that was finished or a run
that was recorded, never a line that was merely written. A change's task
list is created by the same commit that proposes it, so dating work by
when its lines were written reports the proposal date under another
name — measured across 185 changes, that field was exactly zero days
after the proposal for every one of them. A run that was recorded SHALL
be evidence in every host, not only where a test can supply it.

A date that cannot be determined SHALL be reported as absent, with its
source saying so. A missing date filled in with today's is the kind of
figure that is believed because it looks computed. A date that cannot be
read SHALL be absent too, with its source saying it was unreadable, and
SHALL NOT fail the reading of any other change.

Dates SHALL be read from the repository's own record — the commits that
added the files, the times its task lines were checked, the runs
recorded against it — before any convention about how a file or
directory is named. A convention is not followed by someone who has not
read it, and a change created by such a person is the case this exists
for.

A date SHALL NOT be read from a field a person writes by hand. Nothing
checks it against what the repository records, so it is the one that
goes wrong.

#### Scenario: A change archived by the archive command

- **WHEN** a change's dates are read after `openspec archive` moved it
- **THEN** the archived date comes from the commit that moved it, and
  says so

#### Scenario: A change archived early in the morning

- **WHEN** the commit that archived a change was made after midnight in
  the committer's timezone
- **THEN** its archived day is that day, the same day its directory
  names

#### Scenario: A change archived by moving the directory

- **WHEN** the directory carries no dated prefix and no commit moved it
- **THEN** the archived date is reported as absent rather than guessed

#### Scenario: A directory name that is not a date

- **WHEN** an archived directory carries a prefix shaped like a date
  that is not one, and no commit dates it
- **THEN** its archived date is absent and says it was unreadable, and
  every other change is still dated

#### Scenario: When the work happened

- **WHEN** a change's tasks were checked over several days
- **THEN** the first and last of those are carried, distinct from when
  the change was proposed and when it was archived

#### Scenario: A task list written but never worked

- **WHEN** a change's task list exists and nothing in it is checked, and
  no run is recorded against it
- **THEN** no work dates are carried, rather than the date the file was
  written

#### Scenario: A run before the first checked task

- **WHEN** a run is recorded against a change before any of its tasks is
  checked, and the timeline is read through a host
- **THEN** the work started when the run did, and says it came from the
  audit log

#### Scenario: A change nobody has committed

- **WHEN** a change exists only in the working tree
- **THEN** its proposed date is absent, and its source says there is
  nothing to read it from

### Requirement: What a project finished is readable as a chart

What a project finished and how long its changes took SHALL be readable
as a chart, in every host that shows the timeline.

Reading the shape of a project's work by opening its change directories
does not scale past the first few dozen; this repository carries 185.

Every chart SHALL state what it rests on: how many changes it drew, how
many were left out for having no date, and how many of its dates came
from a commit rather than from a naming convention. A chart that drops
the source plots an inference and a measurement identically, which is
the confusion the dates were built to remove.

A chart SHALL NOT be shown for a figure measured to be flat. A chart of
a quantity that is nearly always zero reads as a finding rather than as
an absence, and the absence is the finding. The sentence saying so SHALL
be computed from the changes shown, not stated as a fact about one
repository to every user.

Every chart's values SHALL also be readable as text, so what it shows
can be read by a screen reader and copied.

What a chart computes SHALL live in core, so a host that shows the same
figure in another form — a report, a tree — draws it from the same
function. A bucket SHALL be named by its boundaries.

#### Scenario: Reading what was finished

- **WHEN** the timeline is shown for a set of changes
- **THEN** a chart shows how many were archived per day, with how many
  changes it rests on and where their dates came from

#### Scenario: A change with no date

- **WHEN** a change carries no archived date
- **THEN** it is excluded from the chart and counted as excluded, rather
  than plotted at a guessed date

#### Scenario: Reading a chart as text

- **WHEN** a chart is shown
- **THEN** the same values are present as text

#### Scenario: The chart that is not drawn

- **WHEN** the timeline is shown for a workspace
- **THEN** the sentence explaining the absent work-duration chart gives
  that workspace's own count of changes and how many were flat

### Requirement: What is waiting on a person is readable in every host

Unticked items that no implementing agent will close SHALL be readable
in every host, naming the change each belongs to and who each waits on.

A change waiting on a live check and a change nobody has started are the
same row in a list of changes: both are in progress with a task open.
Telling them apart by opening each change's task file does not scale, and
this repository has already been asked to.

An item SHALL say whether it waits on a person or on a named agent. "No
agent can make this check" and "the agent running this change cannot
make it" are different facts, and only the first is a question for a
person. An item naming an agent SHALL name it by its registry id, and an
id that is not registered SHALL be reported as unknown rather than
counted as delegated — an item delegated to nobody looks assigned and is
not.

An item that names an agent SHALL also state the evidence that agent
must record, and SHALL be ticked only with that evidence recorded beside
it. An agent asked to confirm that something works will confirm that it
works; an agent asked to quote a line either has it or does not.

The collecting SHALL be done in one place both hosts read. Two walks over
the same files drift into two answers about the same workspace.

An empty result SHALL say which empty it is: nothing waiting, or nothing
read.

Where the collecting fails, the surface SHALL say that it failed and why,
in the place the count would have been. A failure rendered as an absent
block is indistinguishable from a block not yet loaded, which is the
distinction this surface exists to make.

Neither surface SHALL offer to tick an item. The point of such an item is
that the thing was done and recorded; a control that records it without
that is a control for recording something untrue.

#### Scenario: A change waiting on a live check

- **WHEN** an active change has an unticked item that no implementing
  agent will close
- **THEN** it is listed as waiting, naming the change, the item, and who
  it waits on

#### Scenario: An item delegated to an agent

- **WHEN** an active change has an unticked item naming a registered
  agent
- **THEN** it is listed as waiting on that agent, distinctly from the
  items waiting on a person

#### Scenario: An item naming an agent that is not registered

- **WHEN** an unticked item names an agent id the registry does not
  carry
- **THEN** it is reported as waiting on an unknown agent, not counted as
  delegated

#### Scenario: Nothing waiting

- **WHEN** no active change has such an unticked item
- **THEN** the surface says nothing is waiting, and how many changes it
  read

#### Scenario: The collecting fails

- **WHEN** the task files of a workspace cannot be read
- **THEN** the surface says the inbox could not be read, and why, rather
  than showing no block

### Requirement: An unaccounted-for documentation picture fails a check

Every image file under the repository's documentation images directory
SHALL be either produced by a named end-to-end capture or listed, with a
reason from a closed set and the date it was taken, as one no capture
can produce. A file that is neither SHALL fail a repository check that
names it.

The requirement above states what must be true; without a check, what is
true is that twenty pictures drifted for six weeks and nothing said so.

A listing that names a file which no longer exists SHALL fail the same
check: a list that outlives what it describes stops being a description
of the repository.

#### Scenario: A picture is added by hand

- **WHEN** an image is added to the documentation images directory with
  neither a capture that writes it nor an entry explaining why none can
- **THEN** the check fails and names that file

#### Scenario: A listed picture is deleted

- **WHEN** a listed hand-taken picture is removed from the repository
  and its entry is left behind
- **THEN** the check fails and names the entry

