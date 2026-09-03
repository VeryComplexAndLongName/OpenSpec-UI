## ADDED Requirements

### Requirement: A stage may set a reasoning effort and a spending cap

A stage's configuration entry SHALL be able to carry a reasoning effort
and a spending cap for the agent that runs it.

Both SHALL be settable in the repository-wide configuration and in a
change's own configuration, resolving through the same merge as every
other stage setting. Neither SHALL be restricted to one of the two files.

An entry that sets neither SHALL produce exactly the command it produced
before these settings existed.

#### Scenario: A repository-wide effort

- **WHEN** the repository-wide configuration sets an effort for a stage
- **THEN** a run of that stage is invoked with it

#### Scenario: A change overrides the repository-wide value

- **WHEN** a change's own configuration sets a different effort for a
  stage that the repository-wide configuration also sets
- **THEN** a run of that stage for that change uses the change's value

#### Scenario: Neither setting is configured

- **WHEN** a stage entry carries neither setting
- **THEN** the agent is invoked exactly as it was before these settings
  existed

### Requirement: A setting an agent cannot honour is refused, never ignored

Where an agent has no way to express a configured setting, the system
SHALL refuse that configuration and SHALL name the agent and the setting.

Where an agent expresses a setting but does not accept the configured
value, the system SHALL refuse it and SHALL name the values it accepts.

A refusal SHALL happen when the configuration is resolved, before any run
starts. The system SHALL NOT accept a setting and then invoke the agent
without it.

#### Scenario: The agent has no such control

- **WHEN** a stage sets a reasoning effort for an agent that has no
  command-line control for it
- **THEN** the configuration is refused, naming that agent and that
  setting

#### Scenario: The agent does not accept the value

- **WHEN** a stage sets a reasoning effort the configured agent does not
  accept
- **THEN** the configuration is refused, naming the values that agent
  accepts

#### Scenario: A spending cap in the wrong unit

- **WHEN** a stage sets a spending cap in a unit its agent does not use
- **THEN** the configuration is refused

### Requirement: Spending caps are carried in each agent's own unit

The system SHALL carry a spending cap in the unit the agent itself uses,
and SHALL NOT convert between units.

#### Scenario: Two agents with different units

- **WHEN** two stages set spending caps for agents that measure spending
  differently
- **THEN** each carries its own unit, and neither value is converted into
  the other

### Requirement: The permitted command shape stays closed

The set of arguments an agent may be invoked with SHALL remain a fixed
prefix plus a known set of optional arguments, each with its own permitted
values.

An argument outside that set, or a permitted argument carrying a value
outside its permitted values, SHALL prevent the run.

Where a setting is expressed through an agent's general configuration
mechanism, only the specific setting SHALL be permitted — not that
mechanism in general.

#### Scenario: A permitted optional argument

- **WHEN** a run is invoked with the expected arguments plus a permitted
  optional argument carrying a permitted value
- **THEN** it is allowed

#### Scenario: A permitted argument with an unpermitted value

- **WHEN** a run is invoked with a permitted optional argument carrying a
  value outside its permitted values
- **THEN** it is refused

#### Scenario: A general configuration mechanism carrying another setting

- **WHEN** a run is invoked with an agent's general configuration
  mechanism carrying any setting other than the one this system
  configures
- **THEN** it is refused
