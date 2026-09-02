## ADDED Requirements

### Requirement: A status result does not claim task progress it does not have

When the underlying tool reports no task progress for a change, the
status result SHALL report that progress is unknown, rather than
substituting a value derived from which artifact files exist. An
artifact's completeness means the file is present; it says nothing about
whether the change's tasks are done, and the two SHALL NOT be reported
through the same value.

#### Scenario: The tool reports task progress

- **WHEN** the underlying tool includes task progress for a change
- **THEN** it is reported unchanged

#### Scenario: The tool reports no task progress

- **WHEN** the underlying tool includes no task progress
- **THEN** the result reports progress as unknown, and no value is
  derived from artifact presence
