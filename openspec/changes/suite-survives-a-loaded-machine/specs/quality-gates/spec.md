## ADDED Requirements

### Requirement: A check whose cost varies with the machine states its own budget

Where a check's duration depends on how busy the machine is — because it
does filesystem work, spawns processes, or builds fixtures — it SHALL
carry a time budget chosen from a measurement of that check, and SHALL
NOT rely on the default budget intended for fixed-cost unit tests.

The measurement the budget was chosen from SHALL be recorded with it, so
a later failure can be told from a budget that was never justified.

A budget SHALL be raised only where the check has been established to be
slow rather than stalled. Where a check makes no progress, the system
SHALL treat that as a defect to diagnose rather than a budget to widen.

#### Scenario: The machine is busy

- **WHEN** the suite runs while other work occupies the machine
- **THEN** a check whose cost varies still completes within its budget,
  and reports on the behaviour it asserts

#### Scenario: A check stalls rather than slows

- **WHEN** a check makes no progress rather than running slowly
- **THEN** widening its budget is not the remedy, and the stall is
  diagnosed

#### Scenario: The behaviour under test regresses

- **WHEN** what a check asserts is actually violated
- **THEN** it fails on that, not on time
