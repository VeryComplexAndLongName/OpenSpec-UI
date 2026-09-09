## ADDED Requirements

### Requirement: A per-change stage entry overrides the fields it names

Where a change's configuration sets a stage that the base configuration
also sets, the resolved entry SHALL take the fields the change names and
SHALL inherit the rest from the base.

The base file is the default and the change states its differences. A
stage entry replaced outright makes "run this stage at higher effort"
also mean "and forget which model I chose", which no one writing it
intends and nothing reports.

Where the change names a **different agent** for that stage, nothing
SHALL be inherited. A stage's model, effort and budget belong to its
agent: effort vocabularies differ between agents, and a budget is
denominated in whichever unit its agent reports, so carrying them across
a change of agent produces a configuration its author never wrote.

#### Scenario: A stage override that names only the effort

- **WHEN** the base sets a model for a stage and the change sets only an
  effort for it
- **THEN** the resolved stage keeps the base's model and takes the
  change's effort

#### Scenario: A stage override that names a different agent

- **WHEN** the base sets a model, effort and budget for a stage and the
  change names a different agent for it
- **THEN** the resolved stage carries only what the change names
