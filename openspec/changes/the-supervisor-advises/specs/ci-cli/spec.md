## ADDED Requirements

### Requirement: The terminal shows what the supervisor finds

`openspec-ui-cli advise` SHALL print the supervisor's suggestions with the
others, in text and in JSON. `openspec-ui-cli run` SHALL print a failed
run's diagnosis beneath its failure.

#### Scenario: A silent run seen from a terminal

- **WHEN** a run has said nothing new past the threshold and `advise` is
  run
- **THEN** the suggestion is printed with its reason and its commands

#### Scenario: A run that fails in the terminal

- **WHEN** `openspec-ui-cli run` ends with a failed stage that carries a
  diagnosis
- **THEN** the cause, whether repeating can help, the quoted line and the
  remedy are printed after the failure
