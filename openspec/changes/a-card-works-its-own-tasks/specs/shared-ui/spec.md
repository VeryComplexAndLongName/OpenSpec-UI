## ADDED Requirements

### Requirement: A card's task is shown whole

A card's task row SHALL carry the task's whole text and what is written
under it in `tasks.md`. Hovering the row SHALL show all of it, and
selecting the row, by pointer or keyboard, SHALL show it whole in a panel
beside the board, on a card read from any directory. A card's height is
derived from what it lists, so a task is not opened inside the card.

#### Scenario: A wrapped task with a record

- **WHEN** a task's sentence wraps onto two more lines and a record is
  written under it
- **THEN** the row's hint holds all of it, and selecting the row shows it
  whole beside the board

### Requirement: A card acts on its change's own worktree only

A card SHALL offer to tick or untick a task, to commit and push its
`tasks.md`, and to run a delegated task only where the card was read from
the change's own worktree: a working directory of this repository paired
with the change by its branch, holding the change's `tasks.md`. The host
SHALL resolve that directory from the change's name and SHALL NOT write to
a path a request names. A card read from this checkout or from any other
directory SHALL offer none of these.

#### Scenario: A change worked in its own worktree

- **WHEN** a change exists only in its own worktree
- **THEN** its card offers the task controls

#### Scenario: A change in this checkout

- **WHEN** a card was read from this checkout
- **THEN** it offers no task control

### Requirement: A task is ticked or unticked with a note

Ticking or unticking a task SHALL change that task's checkbox and nothing
else on its line, and SHALL write the note, where given, as one line under
the task naming who and when. A tick of a **Human-only** or **Delegated**
task SHALL require a note. The change SHALL be refused while a run works in
that worktree, naming the run, and where the task's line no longer reads as
it did when shown.

#### Scenario: Closing a Human-only task

- **WHEN** a person ticks a Human-only task with the note "seen in the
  Pipeline"
- **THEN** the task reads `[x]`, a line under it reads "Closed by <author>
  on <date>: seen in the Pipeline", and the merge gate counts it as recorded

#### Scenario: A Human-only task without a note

- **WHEN** a person ticks a Human-only task with no note
- **THEN** nothing is written and the card says a note is required

#### Scenario: A run is working there

- **WHEN** a run holds the worktree
- **THEN** the tick is refused and the card names the run

### Requirement: A task list is committed and pushed from its card

The card SHALL offer to commit the change's `tasks.md` alone in its own
worktree and push that worktree's branch. It SHALL NOT stage another file,
SHALL refuse on a detached head or the default branch, and SHALL report a
rejected push in git's words.

#### Scenario: After closing a task

- **WHEN** a person commits and pushes after ticking a task
- **THEN** one commit holding only `tasks.md` is pushed to the change's
  branch, and the card says which commit

### Requirement: A delegated task runs from its row

The row of a **Delegated** task in an own worktree SHALL offer to run the
agent it names, through the same route as the inbox, so the run passes the
same allowlist, sandbox and audit.

#### Scenario: Running a delegated task

- **WHEN** a person runs a delegated task from its row
- **THEN** that agent runs on that line in the change's own worktree

### Requirement: An open card can hide done tasks and shows the task in hand

An open card SHALL offer to hide its done tasks, remembered by the host
like its open cards, and SHALL bring the task in hand, or the probable
next one, into view when it opens.

#### Scenario: Hiding done tasks

- **WHEN** a person hides done tasks on an open card
- **THEN** only open tasks are listed, and the choice holds after a reload
