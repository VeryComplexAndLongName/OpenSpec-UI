## MODIFIED Requirements

### Requirement: A configuration says which of its ceilings cannot act

Where a configured ceiling cannot act on the agent chosen for a stage,
the editor SHALL say so where the configuration is chosen, before a run.

A ceiling that cannot fire is indistinguishable from one that has not
fired yet, and the difference is discovered otherwise only by a bill.

Where a stage's agent reports nothing and no time ceiling is configured,
the editor SHALL report that the stage can run without any bound. This is
the finding that matters most, because it is the one with no upper
limit at all.

Where a chain ceiling is set in a unit that no stage's agent is billed
in, or that only agents reporting nothing are billed in, the editor SHALL
report that ceiling as one that cannot act, naming the unit.

A configuration SHALL NOT be refused for this. An operator may knowingly
set a ceiling that binds some stages and not others; that judgement is
theirs, and refusing would trade a real use for it.

The report SHALL state what cannot happen and SHALL NOT recommend a
value. What cannot act follows from what an agent reports; what to set
instead needs history the editor does not consult here.

#### Scenario: A cost ceiling over an agent that reports no cost

- **WHEN** a cost ceiling is configured and a stage's agent reports only
  tokens
- **THEN** the editor reports that this ceiling cannot act on that stage

#### Scenario: A stage with no bound at all

- **WHEN** a stage's agent reports nothing and no time ceiling is set
- **THEN** the editor reports that the stage can run without any bound

#### Scenario: An agent never observed

- **WHEN** a stage uses an agent whose reporting has never been observed
- **THEN** the editor says so, rather than asserting that a ceiling will
  or will not act

#### Scenario: The configuration is still accepted

- **WHEN** a configuration contains a ceiling that cannot act
- **THEN** it is accepted, and the report is a statement rather than a
  refusal

#### Scenario: A ceiling in a unit nothing is billed in

- **WHEN** the chain's budget sets a ceiling in a unit that no stage's
  agent is billed in
- **THEN** the editor reports that ceiling as one that cannot act, naming
  the unit

## ADDED Requirements

### Requirement: The chain's spending ceiling carries its unit

The chain's budget SHALL be able to hold a ceiling per unit of account, so
that a chain whose agents are billed in something other than dollars can
be bounded.

Each ceiling SHALL be compared only against what was reported in that same
unit. The product SHALL NOT convert between units, SHALL NOT invent an
exchange rate, and SHALL NOT sum amounts of different units into one
total.

A unit SHALL be the code the agent itself reported, compared without
regard to case.

#### Scenario: A chain billed in credits

- **WHEN** the chain's budget sets a ceiling in credits and its stages
  report costs in credits
- **THEN** the chain stops before the stage that would pass that ceiling,
  as it does for a ceiling in dollars

#### Scenario: Two units, two ceilings

- **WHEN** a ceiling is set in each of two units and stages report in both
- **THEN** each is compared against its own unit's total, and neither
  total includes the other's amounts

#### Scenario: A report in a unit no ceiling names

- **WHEN** a stage reports a cost in a unit the budget sets no ceiling for
- **THEN** the run is not stopped for it, and nothing is added to another
  unit's total
