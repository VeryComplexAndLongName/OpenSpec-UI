## ADDED Requirements

### Requirement: An item names its agent however the name is quoted

An item's marker SHALL name the same agent whether the agent's id is
written bare or enclosed in backticks.

A marker whose quoting is unbalanced SHALL NOT name an agent.

#### Scenario: A quoted id

- **WHEN** an open item's marker encloses a registered agent's id in
  backticks
- **THEN** that item is offered a run by that agent, exactly as with the
  bare id

#### Scenario: Unbalanced quoting

- **WHEN** a marker's id has a backtick on one side only
- **THEN** the item names no agent

### Requirement: A failed delegated run says what the agent last said

Where a delegated run fails or is cancelled, its result SHALL carry the
last lines the agent wrote to its error stream, bounded in size, and its
message SHALL quote the last of them.

A run that finished SHALL NOT carry them.

#### Scenario: An agent that stops with an error

- **WHEN** the agent writes why it stopped to its error stream and exits
  non-zero
- **THEN** the run's message states the exit and quotes that line

#### Scenario: A run that finished

- **WHEN** a delegated run finishes
- **THEN** its result carries no error output

### Requirement: A delegated run keeps a status record

A delegated run SHALL keep the same status record any other run keeps,
naming the change it works on, for the length of the run, whichever host
started it.

#### Scenario: A delegated run under way

- **WHEN** a delegated run is under way
- **THEN** reading run statuses reports it, with its change
