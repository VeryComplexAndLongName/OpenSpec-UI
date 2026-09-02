## ADDED Requirements

### Requirement: A harness stage may select a model alongside its agent

A `stepAgents` entry SHALL accept either an agent id on its own, or an
agent id together with a model. When a model is given, it SHALL be passed
to that agent's CLI, which continues to own its own authentication. The
existing agent-id-only form SHALL keep its current meaning, so
configurations written before this capability remain valid unchanged.

A model SHALL be rejected when the configuration is read — not when a run
starts — if it does not match the permitted character set, or if it is
set for an agent that accepts no model.

#### Scenario: A stage names only an agent

- **WHEN** a stage's entry is an agent id on its own
- **THEN** the stage runs on that agent exactly as before, with no model
  passed to its CLI

#### Scenario: A stage names an agent and a model

- **WHEN** a stage's entry names both an agent and a model, and that
  agent accepts a model
- **THEN** the stage runs on that agent with that model selected

#### Scenario: A model set for an agent that accepts none

- **WHEN** a stage names a model for an agent whose registry entry
  declares no model support
- **THEN** reading the configuration fails with an error naming the stage
  and the agent, and no run is started

#### Scenario: A malformed model value

- **WHEN** a stage's model contains whitespace, a quote, or a leading
  dash
- **THEN** reading the configuration fails with an error naming the
  stage, and the value never reaches the spawned process

#### Scenario: The user runs a stage on a different agent than configured

- **WHEN** a stage has a model configured for one agent, and the user
  starts that stage on a different agent
- **THEN** no model is passed, because a model id is specific to the CLI
  it was configured for

#### Scenario: A per-change file overrides the global model

- **WHEN** the global configuration sets one model for a stage and a
  change's own harness file sets another
- **THEN** the change's model is used for that stage
