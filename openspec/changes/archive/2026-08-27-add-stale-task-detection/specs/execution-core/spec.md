## ADDED Requirements

### Requirement: Stale-pending-task detection

The system SHALL determine, for a still-pending task, whether it has
sat untouched (per git blame on `tasks.md`) longer than a configurable
threshold, defaulting to 14 days. A task with an undeterminable
last-touched date SHALL never be flagged, and a completed task SHALL
never be flagged regardless of age.

#### Scenario: A pending task untouched past the threshold

- **WHEN** a still-pending task's last-touched date is older than the
  configured threshold
- **THEN** the system reports it as stale

#### Scenario: A pending task touched recently

- **WHEN** a still-pending task's last-touched date is within the
  configured threshold
- **THEN** the system does not report it as stale

#### Scenario: A completed task, regardless of age

- **WHEN** a task is checked off, however old its last-touched date
- **THEN** the system never reports it as stale

#### Scenario: An undeterminable last-touched date

- **WHEN** a pending task's last-touched date cannot be determined
  (e.g. blame unavailable)
- **THEN** the system does not report it as stale
