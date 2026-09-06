## ADDED Requirements

### Requirement: A run records the resource usage its agent reported

Where an agent reports resource usage for a run, the system SHALL record
it with that run's audit entry, so that anything reading recorded usage
sees what was actually spent.

The system SHALL record only what the agent reported. It SHALL NOT
estimate, derive, or infer a figure, and SHALL NOT record a measure of
something other than consumption as consumption.

Where an agent reports nothing, the run SHALL record no usage at all —
never a zero. Absent means unreported, and a ceiling compared against an
absent figure SHALL continue to permit the work rather than refuse it.

Where a reported cost is expressed in a currency other than the one the
recorded field is defined in, the system SHALL preserve the currency and
SHALL NOT convert between them.

#### Scenario: An agent that reports usage

- **WHEN** a run's agent reports token usage or cost for that run
- **THEN** the run's audit entry carries it

#### Scenario: An agent that reports nothing

- **WHEN** a run's agent reports no usage
- **THEN** the run's audit entry carries no usage field, and a configured
  ceiling still permits the next stage

#### Scenario: A measure that is not consumption

- **WHEN** an agent reports how much of its context window is in use
- **THEN** that figure is not recorded as tokens consumed

#### Scenario: A cost in another currency

- **WHEN** a reported cost is in a currency other than the recorded
  field's own
- **THEN** the currency is preserved and no conversion is performed

### Requirement: A configured ceiling acts on recorded usage

A configured spending ceiling SHALL be compared against the usage
recorded for that change, and SHALL stop the work at the next stage
boundary once the recorded total reaches it.

The system SHALL make clear which agents report usage, so that a person
setting a ceiling can tell whether it can reach their runs at all.

#### Scenario: Recorded usage reaches the ceiling

- **WHEN** the usage recorded for a change reaches its configured ceiling
- **THEN** the chain stops before the next stage, saying it stopped for
  the ceiling and not because a stage failed

#### Scenario: An agent that reports nothing, under a ceiling

- **WHEN** every run for a change reported no usage, and a ceiling is
  configured
- **THEN** the chain continues, because nothing recorded has reached
  anything
