## ADDED Requirements

### Requirement: A change lands with nothing open

The validation command SHALL accept the change a pull request is for,
and SHALL refuse that change where any of its task items is open,
naming each by its number and its text.

It SHALL also refuse that change where an item marked as needing a
person, or naming an agent, is closed with nothing written under it.

The rule SHALL apply to that change alone. Every other active change
SHALL be validated for structure exactly as before, so that a pull
request for one change never fails for another change's open item -
a change merged and waiting on its owner is the ordinary state of this
repository, not a fault in somebody else's work.

Where the change given names no active change, the rule SHALL be
skipped rather than guessed at, and the structural validation SHALL be
unchanged. A pull request that archives a change, or that carries an
article, names no active change and SHALL pass.

#### Scenario: A pull request whose change still has an item open

- **WHEN** the gate is given a change with an unticked item
- **THEN** it fails, and names that item by number and text

#### Scenario: A pull request whose change is closed

- **WHEN** every item of the given change is closed, and every
  human-only or delegated item among them has a record
- **THEN** the gate passes

#### Scenario: Another change has something open

- **WHEN** the given change is closed and a different active change has
  an open item
- **THEN** the gate passes: the other change is validated for structure
  only

#### Scenario: A branch that names no change

- **WHEN** the gate is given a name no active change has
- **THEN** it validates structure as before and applies no open-item
  rule
