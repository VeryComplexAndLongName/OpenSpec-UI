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

Where a surface cannot be driven this way — the editor's own menus and
quick-picks are not reachable from a browser — documentation SHALL be
written to stand without a picture of it rather than carry one nothing
checks.

#### Scenario: A screen changes under a captured screenshot

- **WHEN** a screen a documentation screenshot depends on changes
- **THEN** the capture fails on the element it can no longer find, rather
  than producing a picture of the wrong screen

### Requirement: A change is dated by evidence, and each date says where it came from

A change SHALL carry the dates it can be dated by — when it was
proposed, when it was first worked on, when it was last worked on, and
when it was archived — and each SHALL carry the source it was read from.

A date read from a commit and a date read from a directory name are
different claims. Presented alike they plot alike, and the one that
survives someone renaming a directory is not the one that looks the
same.

A date that cannot be determined SHALL be reported as absent, with its
source saying so. A missing date filled in with today's is the kind of
figure that is believed because it looks computed.

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

#### Scenario: A change archived by moving the directory

- **WHEN** the directory carries no dated prefix and no commit moved it
- **THEN** the archived date is reported as absent rather than guessed

#### Scenario: When the work happened

- **WHEN** a change's tasks were checked over several days
- **THEN** the first and last of those are carried, distinct from when
  the change was proposed and when it was archived

#### Scenario: A change nobody has committed

- **WHEN** a change exists only in the working tree
- **THEN** its proposed date is absent, and its source says there is
  nothing to read it from

