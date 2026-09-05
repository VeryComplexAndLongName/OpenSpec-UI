## ADDED Requirements

### Requirement: A check whose cost grows with the repository carries its own budget

Where a check's work grows with the size of the repository — reading
every file of a kind, rather than a fixed set — it SHALL be given a time
budget chosen for that growth, and SHALL NOT rely on the default budget
intended for fixed-cost unit tests.

The budget SHALL be recorded alongside the measurement it was chosen
from, so that a later failure can be told apart from a budget that was
never justified.

Such a check SHALL fail only on the behaviour it asserts, and SHALL NOT
fail because the repository has grown since the budget was set.

#### Scenario: The repository grows

- **WHEN** files of the kind the check reads are added
- **THEN** the check still completes within its budget and reports on the
  behaviour it asserts

#### Scenario: The check runs alongside the rest of the suite

- **WHEN** the check runs under full-suite load rather than alone
- **THEN** its budget still accommodates it

#### Scenario: The behaviour under test regresses

- **WHEN** what the check asserts is actually violated
- **THEN** it fails on that, not on time
