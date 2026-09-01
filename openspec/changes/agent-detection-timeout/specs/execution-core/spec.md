## ADDED Requirements

### Requirement: Presence detection allows a slow CLI enough time to start

Agent presence detection SHALL allow an executable enough time to start
before concluding it is absent, so that an installed CLI on a loaded
machine is not reported as missing. An executable that cannot be found
SHALL still resolve immediately rather than waiting out that budget.

#### Scenario: An installed CLI is slow to start

- **WHEN** an agent's executable exists but takes several seconds to
  respond to a version probe
- **THEN** detection reports that agent as present

#### Scenario: The executable does not exist

- **WHEN** an agent's executable cannot be found on the machine
- **THEN** detection reports that agent as absent without waiting for the
  probe budget to elapse

#### Scenario: A probe never completes

- **WHEN** a probe neither exits nor fails within the budget
- **THEN** detection reports that agent as absent rather than waiting
  indefinitely
