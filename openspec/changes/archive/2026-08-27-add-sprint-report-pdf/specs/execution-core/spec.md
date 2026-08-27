## ADDED Requirements

### Requirement: Sprint report generation

The system SHALL generate, for a given set of changes and a date
range, a sprint summary containing each change's best-effort git
authorship, dates, task completion, and a plain-text summary, plus
aggregate statistics (total changes, tasks completed within the range,
and a per-author change count), rendered as a PDF document.

#### Scenario: Authorship for a change with a single commit

- **WHEN** authorship is determined for a change whose directory has
  exactly one commit touching it
- **THEN** that commit's author is reported as both the primary author
  and the sole contributor

#### Scenario: Authorship for a change with multiple commits by different authors

- **WHEN** authorship is determined for a change touched by commits
  from more than one author
- **THEN** the most recent commit's author is reported as the primary
  author, and every distinct author is listed among the contributors

#### Scenario: A task completed within the requested range

- **WHEN** a selected change's task was completed (per its best-effort
  date) within the requested date range
- **THEN** it counts toward that change's and the report's total
  tasks-completed-in-range figure

#### Scenario: A selected change started before the requested range

- **WHEN** a user explicitly selects a change for the report whose
  created date falls before the requested range
- **THEN** the change still appears in the report; only its
  task-completion counts are filtered by the range

#### Scenario: Authorship is undeterminable

- **WHEN** git history for a change's directory is unavailable or
  yields no commits
- **THEN** the report includes the change with no primary author or
  contributors, rather than failing to generate
