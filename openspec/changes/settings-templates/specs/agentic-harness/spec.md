## ADDED Requirements

### Requirement: A configuration can be chosen by intent

The editor SHALL offer named configurations describing what a person is
trying to do, each applying agents, ceilings and autonomy together.

Each SHALL state what it is for **and when it is the wrong choice**. A
list of options carrying only advantages gives no help choosing between
them.

Each SHALL state which of its values were measured and which are
judgement, so that a reader can disagree with the right ones.

Each SHALL declare where it may be applied. Three settings are valid only
in a per-change configuration, and offering them globally would produce a
template refused on save.

#### Scenario: A named configuration is applied

- **WHEN** a person applies one
- **THEN** the agents, ceilings and autonomy it names are set together

#### Scenario: A configuration valid only per change

- **WHEN** a named configuration sets a value a global file may not carry
- **THEN** it is not offered for the global file

### Requirement: A named configuration cannot contradict itself

A named configuration SHALL NOT contain a ceiling that cannot act on the
agent it names for that stage.

The product records what each agent reports, and reports to a person when
a configured ceiling cannot act. Shipping a named configuration that
triggers that report would be publishing the very confusion the report
exists to catch, under the product's own name.

#### Scenario: A named configuration is checked

- **WHEN** a named configuration is examined against what its agents
  report
- **THEN** it produces no finding that a ceiling cannot act
