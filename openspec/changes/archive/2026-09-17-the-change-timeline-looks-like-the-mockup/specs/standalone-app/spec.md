## MODIFIED Requirements

### Requirement: A Timeline tab shows a change's tasks positioned by completion date

The system SHALL offer a Timeline tab where the user selects any active
or archived change and sees when its work happened. Choosing a change
SHALL load it, with no further control to press.

The tab SHALL show:

- the moments the change has a time for, oldest first: when it was
  proposed, each moment tasks were ticked, and when it was archived. Tasks
  ticked at the same instant SHALL be one moment that says how many;
- how many of its tasks are done, of how many, and how long it took from
  its proposal to its archive, or to its last work while it is active;
- its proposed, first worked, last worked and archived dates, each with
  where it was read from;
- its open tasks, and its done tasks whose completion date cannot be
  determined, listed apart from the moments rather than omitted or given a
  misleading date;
- its proposal, design and spec content, on request.

Times SHALL be shown in the viewer's own time zone, and the tab SHALL say
so.

#### Scenario: User selects an active change

- **WHEN** the user selects an active change in the Timeline tab
- **THEN** the tab shows that change's moments oldest first, its open
  tasks, and how long it has run to its last work

#### Scenario: User selects an archived change

- **WHEN** the user selects an archived change in the Timeline tab
- **THEN** the tab shows the same, ending with the moment it was
  archived, and the span from its proposal to its archive

#### Scenario: User chooses another change while one is shown

- **WHEN** a change's timeline is shown and the user chooses another
- **THEN** the shown timeline goes at once, and nothing on the page names
  the change chosen before while the other is read

#### Scenario: Tasks ticked in one commit

- **WHEN** twenty-seven tasks of a change carry the same completion instant
- **THEN** the tab shows one moment saying twenty-seven tasks were ticked
  in one commit, lists the first of them, offers the rest, and says why
  they share a time

#### Scenario: A task wrapped over several lines

- **WHEN** a task's sentence runs over three lines of `tasks.md`
- **THEN** the tab shows the whole sentence, without its Markdown marks, and
  not only its first line

#### Scenario: A task has no determinable completion date

- **WHEN** a task is still pending, or its completion date cannot be
  determined
- **THEN** it is listed apart from the moments, without a date, rather
  than omitted or given a misleading date

#### Scenario: Where a date came from

- **WHEN** a change's proposed date was read from a git commit and its
  last worked date from git blame on its tasks
- **THEN** the tab says so beside each date

### Requirement: The Timeline tab's staleness threshold is user-configurable

The system SHALL let the user set the stale-pending-task threshold (in
days) in the standalone Timeline tab, defaulting to 14 days, and apply
it when rendering a change's timeline.

#### Scenario: User changes the threshold

- **WHEN** the user sets a different stale-after value while a change's
  timeline is shown
- **THEN** open tasks are flagged stale according to the new value, without
  the timeline being read again
