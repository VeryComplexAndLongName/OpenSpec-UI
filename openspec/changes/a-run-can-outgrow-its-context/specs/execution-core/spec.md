## ADDED Requirements

### Requirement: A ceiling on how full a run's context may get

The system SHALL support a configured ceiling on how much of its context
window a run may fill, as a share of that window. A value outside the
range above zero and at most one SHALL be refused where the configuration
resolves, rather than accepted as a ceiling that could never act.

Where an agent says during a run how many tokens are in its context and
how large that window is, and the share of the two passes the ceiling,
the system SHALL stop the run. It SHALL do so **while the stage is
running**, which is possible here and not for a spending ceiling: the
figure arrives during the run rather than at its end.

The run SHALL end as cancelled, not as failed, and the reason SHALL name
the ceiling, its value, and the reading it was judged on. A ceiling doing
its job is not a defect, and a reader has to tell a rule firing from a
person's click.

The figure SHALL NOT be counted as usage against any spending ceiling. It
falls after a compaction, so counting it as consumption would under-count
exactly the long runs that compact.

Where the agent running a stage cannot send that figure at all, the
system SHALL say so from the configuration, before any run under it. Where
whether it sends one has never been observed, the system SHALL say
nothing either way.

#### Scenario: A run fills more of its window than the ceiling allows

- **WHEN** a stage is running under a context ceiling and the agent
  reports a context fuller than it
- **THEN** the run is cancelled while that stage is still going, with a
  reason naming the ceiling, its value and the reading

#### Scenario: A run stays under the ceiling

- **WHEN** every reading a stage reports is below the ceiling
- **THEN** nothing is cancelled and the chain goes on

#### Scenario: A share that is not a share

- **WHEN** a configuration sets the ceiling to a value of zero or below,
  or above one
- **THEN** the configuration is refused, naming the field and the range

#### Scenario: An agent that cannot report a context at all

- **WHEN** a stage's agent sends no such figure by construction and a
  context ceiling is configured
- **THEN** the configuration reports that the ceiling cannot act on that
  stage

#### Scenario: An agent nobody has watched

- **WHEN** a stage's agent has never been observed either sending or not
  sending that figure
- **THEN** nothing is claimed about it, and no warning is raised
