## MODIFIED Requirements

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

#### Scenario: A person who prefers reduced motion

- **WHEN** a tab reads for a person whose system asks for reduced motion
- **THEN** the indicators do not move, and the sentence still names the
  reading

#### Scenario: A run in progress

- **WHEN** a command is running in Run a Command
- **THEN** that tab's control to cancel the run stays available

## ADDED Requirements

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
