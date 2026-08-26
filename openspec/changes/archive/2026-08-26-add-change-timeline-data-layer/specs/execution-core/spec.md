## ADDED Requirements

### Requirement: Best-effort git-derived change and task timestamps

The system SHALL derive, for a given OpenSpec change (active or
archived), a best-effort created date, an archived date when applicable,
and a best-effort completion date per task in `tasks.md`, without
requiring any change to how tasks are authored or checked off. Any date
that cannot be determined (shallow clone, uncommitted file, an
undeterminable blame line) SHALL be reported as absent (`null`) rather
than causing the read to fail.

#### Scenario: Tasks checked off in separate commits

- **WHEN** a change's `tasks.md` has checkboxes that were checked in
  distinct git commits
- **THEN** each checked task's reported date reflects its own commit's
  timestamp

#### Scenario: Tasks checked off in one squash commit

- **WHEN** several tasks were checked as part of a single squash-merge
  commit
- **THEN** all of those tasks report the same date (that commit's
  timestamp) — this is treated as a correct, expected result, not an
  error

#### Scenario: A task has never been checked

- **WHEN** a task's checkbox is still unchecked
- **THEN** its reported date is `null`

#### Scenario: An archived change reports its archive date

- **WHEN** the change is archived (its directory is
  `openspec/changes/archive/YYYY-MM-DD-<name>/`)
- **THEN** the reported archived date is parsed from that folder name,
  without any git call

#### Scenario: Git history is unavailable or insufficient

- **WHEN** the repository is a shallow clone, or a file's history cannot
  be resolved
- **THEN** the affected date(s) are reported as `null`, and the rest of
  the change's data (proposal/design/tasks/spec content, other
  determinable dates) is still returned
