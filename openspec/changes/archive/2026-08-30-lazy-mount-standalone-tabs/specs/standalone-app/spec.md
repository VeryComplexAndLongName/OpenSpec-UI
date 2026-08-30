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
