## ADDED Requirements

### Requirement: The harness schemas answer as the product does

The JSON Schemas the extension contributes for `openspec/agent-harness.json`
and `openspec/changes/<id>/harness.json` SHALL be built by `packages/core`
from the lists its harness validator enforces, and the files the extension
ships SHALL be that output. The build SHALL fail when a top-level key the
validator accepts has no entry in the schema.

A schema SHALL NOT refuse a file the validator accepts, except to mark a
key inside an object that the product reads and ignores. Where it accepts
a file the validator refuses, the case SHALL be written down with the
reason, and a test SHALL assert it as a difference.

#### Scenario: A key is added to the configuration

- **WHEN** a top-level key is added to the validator's accepted keys and
  not to the schema builder
- **THEN** building the schema fails and names the key

#### Scenario: A file the product reads

- **WHEN** a harness file sets `budget`, `timeout`, `branches`, `archive`,
  or a stage's agent as an object with a model and an effort the agent
  accepts
- **THEN** the editor marks nothing in it

#### Scenario: An effort the agent does not accept

- **WHEN** a stage names an agent with an effort that agent does not accept
- **THEN** the editor marks it, as the product refuses it

#### Scenario: A rule of the global file

- **WHEN** `openspec/agent-harness.json` sets `autonomyLevel: "autonomous"`
  or `taskAgents`
- **THEN** the editor marks it and says that only a change's own file may
  set it

#### Scenario: The shipped files are out of date

- **WHEN** the checked-in schema files differ from what core builds
- **THEN** the extension's tests fail
