## ADDED Requirements

### Requirement: Standalone shell can invoke a selectable AI agent

The standalone delivery SHALL execute `plan`, `implement`, and `review`
commands through a CLI agent runner, resolved from the same registry the
UI presents for selection. The system SHALL default to
`DEFAULT_AGENT_ID` when the user has not explicitly picked one.

#### Scenario: User runs implement with the default agent

- **WHEN** the user selects a change, leaves the agent picker at its
  default, and runs "implement"
- **THEN** the command executes through the default agent's runner and
  streams events the same way `status`/`list`/`show`/`validate` already do

#### Scenario: User runs implement with a non-default agent

- **WHEN** the user picks a non-default entry from the agent picker and
  runs "implement"
- **THEN** the command executes through that agent's runner instead

#### Scenario: Selected agent's CLI tool is not installed

- **WHEN** the selected agent's underlying CLI executable is not found on
  the machine
- **THEN** the run reports a `failed` event with a clear reason, the same
  way any other spawn failure already does — no silent hang
