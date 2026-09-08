## ADDED Requirements

### Requirement: What a stage spent is recorded against that stage

A recorded run SHALL carry the stage it belongs to and the effort the
agent was asked for, where both are known.

Every stage of a chain runs under the chain's own run identifier, so a
record without a stage can say what a change cost and cannot say what any
one stage cost. Effort belongs with it because the same stage on the same
agent at different efforts are not comparable figures.

Both SHALL be optional. A record written before these existed is still a
valid record, and a reader has to be able to tell "not recorded" from
"no stage". Such a record SHALL NOT be given a stage after the fact:
inferring one would invent an attribution that was never observed.

Where a run was stopped because a ceiling was reached, the record SHALL
carry that reason, so that a stopped run can be told from one a person
cancelled without inspecting anything else.

#### Scenario: A chain stage runs

- **WHEN** a stage of a chain completes
- **THEN** its record names that stage and the effort it was asked for

#### Scenario: A run that is not part of a chain

- **WHEN** a single-stage run completes
- **THEN** its record carries no stage, and is not given one

#### Scenario: A record written before this existed

- **WHEN** an older record is read
- **THEN** it reports that its stage is not recorded, rather than being
  attributed to one

#### Scenario: A ceiling stopped the run

- **WHEN** a run was stopped because a configured ceiling was reached
- **THEN** its record carries the reason, and no second record is written
  for the same run

### Requirement: One stage's spend can be bounded by the harness itself

The harness SHALL support an optional ceiling on what a single stage
spends, enforced by the harness rather than by the agent's own command
line.

A spending ceiling cannot interrupt a running stage, because a run's cost
is not known until it ends. This one SHALL therefore be evaluated when a
stage ends and SHALL stop the chain rather than the stage — it prevents
the next overspend, not the one that happened.

Where the chosen agent's own command line can cap an invocation, that cap
SHALL continue to be passed through unchanged. The harness ceiling exists
for the agents whose command line offers none, and where both apply the
lower one binds.

Where a ceiling stops the chain, it SHALL name itself and the value it
was set to rather than blaming the stage that reached it.

#### Scenario: A stage spends more than its ceiling

- **WHEN** a stage completes having reported more than the configured
  per-stage ceiling
- **THEN** the chain stops, naming the ceiling and its value

#### Scenario: The agent's own command line has a cap

- **WHEN** the chosen agent accepts a spending flag
- **THEN** that flag is still passed, and both bounds apply

#### Scenario: The agent reports nothing

- **WHEN** a stage's agent reports no usage at all
- **THEN** the ceiling has nothing to compare and does not stop the chain,
  which is the case the time ceiling exists to cover
