## ADDED Requirements

### Requirement: The Change Timeline webview flags stale pending tasks

The system SHALL flag, in the Change Timeline webview, any pending task
that stale-task detection identifies as stale, using a threshold
configurable via the `openspec-ui.staleTaskThresholdDays` setting
(default 14).

#### Scenario: A change has a stale pending task

- **WHEN** the user opens the Change Timeline for a change containing a
  pending task untouched past the configured threshold
- **THEN** that task is visually distinguished from a fresh pending
  task in the webview

#### Scenario: User changes the threshold setting

- **WHEN** the user sets `openspec-ui.staleTaskThresholdDays` to a
  different value and reopens the Change Timeline
- **THEN** the new threshold is used to determine staleness
