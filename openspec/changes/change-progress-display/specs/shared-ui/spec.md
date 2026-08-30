## ADDED Requirements

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
