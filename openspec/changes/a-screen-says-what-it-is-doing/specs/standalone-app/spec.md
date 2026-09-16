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

A tab whose content starts a reading when it mounts SHALL say so, from the
moment it mounts until that reading settles or fails. The sentence SHALL name
what is being read, and SHALL be exposed as a status message rather than
taking focus. A tab that starts no reading SHALL say nothing.

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
- **THEN** the tab shows one status message naming what it is reading, and
  the message goes when the reading settles or fails

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
