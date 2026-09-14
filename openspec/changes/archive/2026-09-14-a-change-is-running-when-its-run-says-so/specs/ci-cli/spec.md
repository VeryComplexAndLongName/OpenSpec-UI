## MODIFIED Requirements

### Requirement: Every active change reports a state with its reason

The CLI SHALL report, for each active change, whether it is running,
ready to start, or blocked.

A state SHALL carry the fact that produced it. `blocked` SHALL name what
blocks it; `running` SHALL name where it is running. A state a reader has to
investigate is a state that has not been reported.

A change SHALL be reported as running either when its working directory
holds the workspace, or when a run's status record that is not past the
staleness window names the change from this working directory or from the
change's own working directory. Where only a record says the change is
running, the report SHALL name no author.

#### Scenario: A change waiting on another

- **WHEN** a change declares a blocker that is still an active change
- **THEN** it is reported as blocked, naming that change

#### Scenario: A change under way

- **WHEN** a change's working directory currently holds the workspace
- **THEN** it is reported as running, naming that directory

#### Scenario: A change a run reports on

- **WHEN** a live status record names a change from this working
  directory, and no lease is held for that change
- **THEN** it is reported as running there, and no author is named

#### Scenario: A change with nothing in its way

- **WHEN** a change declares no unmet blocker and nothing is running it
- **THEN** it is reported as ready
