## ADDED Requirements

### Requirement: A check's budget accommodates its dominant step's variance

Where a check's duration is dominated by a step whose cost varies between
runs, its time budget SHALL be set from the observed range of that step
rather than from a typical run, so that the check reports on what it
verifies rather than on how a runner performed.

Two checks that share a dominant step SHALL NOT be given budgets that
disagree about how long that step takes.

A budget SHALL be recorded with the measurement it was chosen from.

#### Scenario: The dominant step runs slowly

- **WHEN** a check's dominant step takes toward the upper end of its
  observed range
- **THEN** the check still completes and reports its own result

#### Scenario: What the check verifies is violated

- **WHEN** the condition a check exists to catch is actually violated
- **THEN** it fails on that, and its report names it

#### Scenario: Two checks share a step

- **WHEN** two checks both begin with the same installation step
- **THEN** neither is given less time for it than the other
