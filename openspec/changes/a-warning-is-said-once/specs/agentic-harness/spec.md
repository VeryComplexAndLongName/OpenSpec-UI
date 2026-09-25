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

The report SHALL say each thing once. Findings of one kind about one
agent, whose words differ only in the stage they name, SHALL be said as
one sentence naming every stage they hold on, in the order the stages run,
wherever findings are shown: in the settings and in the run dialog. An
agent on every stage that reports nothing gave four lines differing in one
word, which read as four problems (reported by a user on 2026-09-24).

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

#### Scenario: The same finding on every stage

- **WHEN** every stage runs an agent that reports no usage, and a dollar
  ceiling is set
- **THEN** one sentence says that no spending ceiling can act on
  "propose", "review", "apply" and "verify"

#### Scenario: Findings that differ

- **WHEN** two stages' findings differ in kind or in agent
- **THEN** each is said on its own
