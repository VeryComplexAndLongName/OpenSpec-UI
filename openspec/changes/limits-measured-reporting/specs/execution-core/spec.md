## ADDED Requirements

### Requirement: A ceiling's reach is described from evidence, not expectation

Where the system tells a person which agents report resource usage, it
SHALL distinguish reporting that has been observed from reporting that is
expected but unobserved.

Where an agent's reporting has been observed, the description SHALL say
which configured ceilings that agent's reporting can act on, and which it
cannot.

The system SHALL NOT present an expectation derived from an agent's
documented output format as an observation of that agent.

#### Scenario: An agent whose reporting has been observed

- **WHEN** a person reads which agents report usage
- **THEN** an agent observed reporting is marked as observed, and the
  ceilings its reporting can act on are named

#### Scenario: An agent whose reporting has not been observed

- **WHEN** an agent's reporting is expected from its output format but
  has not been seen
- **THEN** it is described as expected rather than as observed

#### Scenario: An agent that reports tokens but not cost

- **WHEN** an agent reports token counts and no cost
- **THEN** the description says a cost ceiling cannot act on that agent,
  and a token ceiling can

### Requirement: A run that records no usage is explained

Where a run can terminate without recording usage, the system SHALL say
so where it describes ceilings, so that a person does not assume every
run's spend counts against one.

#### Scenario: A run that fails before reporting

- **WHEN** a run fails without its agent having reported usage
- **THEN** the description makes clear that such a run contributes
  nothing to a ceiling
