## ADDED Requirements

### Requirement: A running chain shows what it has spent

While a chain runs, the system SHALL show the resource usage its agents
have reported for that run, so that a person watching it can tell what
the work has cost without reading a log file.

The system SHALL show only figures an agent reported. Where a stage's
agent reported nothing, the system SHALL say so, and SHALL NOT show a
zero in place of an unreported figure.

Where reported costs are in different currencies, the system SHALL show
each currency separately and SHALL NOT convert between them.

#### Scenario: An agent reports usage during a chain

- **WHEN** a stage's agent reports usage
- **THEN** the running chain's display includes it

#### Scenario: A stage whose agent reported nothing

- **WHEN** a stage completes having reported no usage
- **THEN** the display says that stage reported nothing, rather than
  showing it as costing zero

#### Scenario: Costs in two currencies

- **WHEN** one stage reports a cost in one currency and another stage
  reports a cost in a different one
- **THEN** both are shown under their own currency and no combined
  figure is invented

### Requirement: Usage is attributed to the stage that spent it

The system SHALL attribute a chain's reported usage to the stage that was
running when it was reported, including the first stage and including a
stage during which the chain stopped.

To make this possible, a chain SHALL announce each stage when it begins,
not only when it ends.

#### Scenario: The first stage's usage

- **WHEN** the first stage of a chain reports usage, before any stage
  boundary has been reached
- **THEN** that usage is attributed to that stage

#### Scenario: A chain that stops during a stage

- **WHEN** a chain fails, is cancelled, or is refused at a ceiling while a
  stage is running
- **THEN** the usage that stage reported is attributed to it, and the
  stage is identified

### Requirement: A live figure is distinguished from a settled one

Where an agent reports figures continuously during a run, the system MAY
show them, and SHALL present them separately from the usage recorded for
completed runs.

The system SHALL NOT present a measure of context occupancy as an amount
consumed, and SHALL NOT include a live figure in a total that a
configured ceiling is compared against.

#### Scenario: An agent reporting continuously

- **WHEN** an agent reports its running cost and context occupancy during
  a stage
- **THEN** those figures are shown as the agent's live report, distinct
  from the usage recorded for finished stages

#### Scenario: Context occupancy

- **WHEN** an agent reports how much of its context window is in use
- **THEN** that figure is not added to any total presented as tokens
  consumed

### Requirement: A configured ceiling is legible against the recorded total

Where a spending ceiling is configured, the system SHALL show it beside
the recorded total it is compared against, and SHALL make clear that
reaching it stops the chain before the next stage rather than
interrupting the stage already running.

Where no ceiling is configured, the system SHALL NOT imply one exists.

#### Scenario: A configured ceiling

- **WHEN** a chain runs under a configured ceiling
- **THEN** the ceiling and the recorded total are shown together

#### Scenario: No ceiling configured

- **WHEN** a chain runs with no ceiling configured
- **THEN** usage is still shown, and nothing suggests a limit is in force
