## ADDED Requirements

### Requirement: A chain's own ending is recorded

When a chain run ends, the audit log SHALL record that ending once, under the
chain's run id. The record SHALL name the stage the chain ended at, and SHALL
give the reason where there is one. This applies to every ending: completed,
failed, and cancelled, including a cancel at a checkpoint and a stop by the
chain's run-time limit or its attempt limit.

A reader that totals runs or spend by agent SHALL NOT count that record as a
unit of work or as spend.

#### Scenario: Cancelled at a checkpoint

- **WHEN** a chain is cancelled while it waits at the checkpoint after apply
- **THEN** the audit log records the chain as cancelled at apply

#### Scenario: Stopped by its run-time limit

- **WHEN** a chain reaches its run-time limit during verify
- **THEN** the audit log records the chain as cancelled at verify, with the
  limit as the reason

#### Scenario: What a cost report counts

- **WHEN** the cost of a change is read after a chain has ended
- **THEN** the chain's own ending adds no row and no spend

### Requirement: How a change's latest run ended can be read

For every active change, the system SHALL answer how the change's latest run
ended, at which stage, when, and at what cost. It SHALL do so by grouping
audit entries by run, across the audit log of every working directory of the
repository.

A cost SHALL be the sum of what the run's entries reported, and SHALL be
absent where none of them reported one.

A run that has started and has not ended SHALL be reported as not ended,
and SHALL NOT be reported as the latest ending.

#### Scenario: A chain that failed at verify

- **WHEN** a change's latest chain ran propose, apply and verify, and failed
  at verify
- **THEN** its latest run is reported as failed at verify, with the time it
  ended and the spend its stages reported

#### Scenario: A run in the change's own worktree

- **WHEN** the change's latest run wrote its audit entries in the change's
  own worktree
- **THEN** that run is still reported as the change's latest run

#### Scenario: No usage reported

- **WHEN** no entry of the latest run reported usage
- **THEN** that run is reported with no cost
