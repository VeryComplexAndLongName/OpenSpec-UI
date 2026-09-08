## ADDED Requirements

### Requirement: What an agent reports is recorded, not only documented

What each agent reports back about its own spending SHALL be recorded
alongside what its command line accepts, so that the product can act on
it rather than only a reader.

The record SHALL distinguish an agent observed to report nothing from one
that has never been observed. Treating the unobserved as reporting
nothing would produce confident statements about facts nobody has
checked.

#### Scenario: An agent reports cost and tokens

- **WHEN** the recorded capability of an agent is read
- **THEN** it says whether that agent reports cost, tokens, neither, or
  whether this has never been observed

### Requirement: A configuration says which of its ceilings cannot act

Where a configured ceiling cannot act on the agent chosen for a stage,
the editor SHALL say so where the configuration is chosen, before a run.

A ceiling that cannot fire is indistinguishable from one that has not
fired yet, and the difference is discovered otherwise only by a bill.

Where a stage's agent reports nothing and no time ceiling is configured,
the editor SHALL report that the stage can run without any bound. This is
the finding that matters most, because it is the one with no upper
limit at all.

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
- **THEN** it is saved and used, with the finding reported alongside it
