## ADDED Requirements

### Requirement: The Timeline tab's staleness threshold is user-configurable

The system SHALL let the user set the stale-pending-task threshold (in
days) in the standalone Timeline tab, defaulting to 14 days, and apply
it when rendering a change's timeline.

#### Scenario: User changes the threshold

- **WHEN** the user sets a different stale-after value and loads (or
  reloads) a change's timeline
- **THEN** pending tasks are flagged stale according to the new value
