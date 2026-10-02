## MODIFIED Requirements

### Requirement: A change's task record states what has actually been done

A change's task record SHALL reflect the state of the repository. Work
that has shipped SHALL be recorded as done, and work that has not SHALL
NOT be.

A verification item SHALL be recorded as done only after it has been
carried out, never in the same act as the work it verifies.

Where an item can only be carried out by a person, it SHALL remain open
until that person has carried it out, and SHALL NOT be inferred from
related evidence.

Where an item is marked as requiring a person or as delegated to an
agent, the evidence closing it SHALL be written in the lines under the
item, which is where the rule that closes the item reads. An item whose
evidence is written only on its own checkbox line SHALL be treated as
recording nothing, because an item's own text already states what it
obliges and nothing distinguishes that text from evidence appended to
it.

#### Scenario: Work has shipped

- **WHEN** a change's implementation is present in the default branch
- **THEN** its task record shows that work as done

#### Scenario: A verification item has not been run

- **WHEN** a verification item's checks have not been carried out
- **THEN** it remains open, whatever the state of the work it verifies

#### Scenario: An item only a person can carry out

- **WHEN** an item is marked as requiring a person
- **THEN** it stays open until that person reports it done, and passing
  automated checks do not close it

#### Scenario: Partial evidence for a verification item

- **WHEN** part of what an item claims has been observed and part has not
- **THEN** the item stays open, rather than being closed on the observed
  part

#### Scenario: Evidence written on the checkbox line alone

- **WHEN** a delegated or human-only item is ticked and its evidence is
  written on the checkbox line, with nothing in the lines under it
- **THEN** the item counts as recording nothing, and the change owes it
  and is not archived, until the evidence is written under the item
