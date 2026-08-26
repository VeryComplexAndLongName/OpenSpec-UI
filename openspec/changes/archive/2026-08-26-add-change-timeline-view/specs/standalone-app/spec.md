## ADDED Requirements

### Requirement: A Timeline tab shows a change's tasks positioned by completion date

The system SHALL offer a Timeline tab where the user selects any active
or archived change and sees its proposal/design/spec content followed
by its tasks, positioned by best-effort completion date (oldest first),
with pending or undated tasks shown distinctly rather than omitted.

#### Scenario: User selects an active change

- **WHEN** the user selects an active change in the Timeline tab and
  loads it
- **THEN** the tab shows that change's proposal/design/spec content and
  its tasks ordered oldest-completed-first

#### Scenario: User selects an archived change

- **WHEN** the user selects an archived change in the Timeline tab and
  loads it
- **THEN** the tab shows the same content, including the change's
  archived date

#### Scenario: A task has no determinable completion date

- **WHEN** a task is still pending, or its completion date cannot be
  determined
- **THEN** it is shown without a date rather than omitted or given a
  misleading date
