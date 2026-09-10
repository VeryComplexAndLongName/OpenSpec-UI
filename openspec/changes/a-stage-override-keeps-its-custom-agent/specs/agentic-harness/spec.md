## MODIFIED Requirements

### Requirement: A per-change stage entry overrides the fields it names

Where a change's configuration sets a stage that the base configuration
also sets, the resolved entry SHALL take the fields the change names and
SHALL inherit the rest from the base. Every field a stage entry may
carry SHALL be merged by this rule, including the custom agent; a field
the merge does not know is a field the override silently loses.

The base file is the default and the change states its differences. A
stage entry replaced outright makes "run this stage at higher effort"
also mean "and forget which model I chose", which no one writing it
intends and nothing reports.

Where the change names a **different agent** for that stage, nothing
SHALL be inherited. A stage's model, effort, budget and custom agent
belong to its agent: effort vocabularies differ between agents, a budget
is denominated in whichever unit its agent reports, and a custom agent
is a definition one CLI reads, so carrying them across a change of agent
produces a configuration its author never wrote.

#### Scenario: A stage override that names only the effort

- **WHEN** the base sets a model for a stage and the change sets only an
  effort for it
- **THEN** the resolved stage keeps the base's model and takes the
  change's effort

#### Scenario: A stage override that names only a custom agent

- **WHEN** the base names an agent for a stage and the change names the
  same agent with a custom agent
- **THEN** the resolved stage carries the custom agent, and it reaches
  the CLI when the stage runs

#### Scenario: A stage override that names a different agent

- **WHEN** the base sets a model, effort and budget for a stage and the
  change names a different agent for it
- **THEN** the resolved stage carries only what the change names

## ADDED Requirements

### Requirement: Applying a named configuration to a change writes one file from every surface

Where a named configuration is applied to a change, the override written
SHALL be the same whichever surface applied it, and SHALL be produced by
one function in core.

A configuration's effort belongs to the agent the stage will run, which
for a stage the override does not name is the base's. A surface that
resolves against the override alone gives no stage an effort and reports
a reason that is not the reason.

The surface SHALL say which stages were given an effort and which agents
accept none. "No agent on screen accepts an effort" SHALL be said only
where that is so.

#### Scenario: The same configuration from two surfaces

- **WHEN** a named configuration is applied to a change from the run
  dialog, and the same one from the settings view
- **THEN** the change's override file is identical

#### Scenario: An override naming no stage

- **WHEN** a named configuration is applied to a change whose override
  names no stage, and the base's agents accept an effort
- **THEN** each stage is written with the base's agent and the resolved
  effort, and the message names them

### Requirement: A configuration's words match what it resolves to

A named configuration's description of the effort it asks for SHALL be
true for every registered agent it can be applied to, and the reference
SHALL show the resolved value per agent.

The levels resolve to positions in an agent's range by thirds, chosen so
that four levels stay distinct over four values. A word such as "middle"
describes a different arithmetic, and a reader of an agent with seven
values is told one thing and given another.

#### Scenario: Reading the balanced configuration for an agent with seven values

- **WHEN** the reference is read for the balanced configuration and an
  agent accepting seven effort values
- **THEN** it shows the value the resolver produces, and the
  configuration's own text does not contradict it
