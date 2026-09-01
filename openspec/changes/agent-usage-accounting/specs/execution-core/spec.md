## ADDED Requirements

### Requirement: A run's audit record carries its resource usage and agent version

The audit record for a run SHALL be able to carry the resource usage
reported for that run and the version of the agent that performed it. Both
SHALL be optional, so that a record written without them remains valid and
readable.

Usage SHALL be recorded only as reported by the agent. The system SHALL NOT
estimate, derive, or otherwise substitute a value for a run whose agent
reported none.

#### Scenario: Usage is reported

- **WHEN** a run's agent reports resource usage for that run
- **THEN** the run's audit record carries it, attributed to that run and
  that agent

#### Scenario: No usage is reported

- **WHEN** a run's agent reports no resource usage
- **THEN** the run's audit record carries none, and the run is otherwise
  recorded exactly as it would have been

#### Scenario: A record written before usage was recordable

- **WHEN** an audit record that predates these fields is read
- **THEN** it remains valid and readable, and is reported as carrying no
  usage

### Requirement: Agent detection reports a best-effort version without gating on it

Agent detection SHALL additionally report the version of each agent it
detects, obtained from the probe it already performs. A version that cannot
be determined SHALL be reported as absent.

Whether an agent counts as detected SHALL NOT depend on whether its version
could be determined.

#### Scenario: The probe reports a readable version

- **WHEN** a detection probe's output contains a version
- **THEN** the detected agent is reported with that version

#### Scenario: The probe reports no readable version

- **WHEN** a detection probe succeeds but its output contains no version
- **THEN** the agent is still reported as detected, with no version

#### Scenario: The probe does not run

- **WHEN** a detection probe fails to start
- **THEN** the agent is reported as not detected, unchanged from before
  versions were reported

### Requirement: Usage is reportable in aggregate, with unmeasured runs distinguished

The system SHALL be able to aggregate recorded usage across runs, grouped by
agent, by model, and by change.

Runs carrying no usage SHALL be reported as a distinct count of unmeasured
runs. They SHALL NOT be counted as zero usage, and SHALL NOT contribute to
any total.

#### Scenario: Runs with and without usage in one report

- **WHEN** an aggregate is built over runs of which some carry usage and
  some do not
- **THEN** the totals reflect only the runs that carry usage, and the runs
  that do not are reported separately as unmeasured

#### Scenario: No runs at all

- **WHEN** an aggregate is built over no runs
- **THEN** it reports zero totals and zero unmeasured runs, rather than
  failing

### Requirement: A configured budget stops work at stage boundaries

The system SHALL support a configured ceiling on what a change's runs may
cost. Where a ceiling is configured, the system SHALL refuse to start a
stage, and SHALL refuse to continue a chain, once recorded usage has
reached it.

The refusal SHALL name the budget as its reason, distinguishably from a run
that failed on its own merits.

A ceiling SHALL be enforced only against usage that was actually reported.
Runs carrying no usage SHALL NOT be counted against it, by any estimate.

The system SHALL NOT be required to interrupt a run already in progress:
enforcement happens at the boundaries between stages, because a run's cost
is not known until it ends.

#### Scenario: Budget remains

- **WHEN** a stage is about to start and recorded usage for its change is
  below the configured ceiling
- **THEN** the stage starts normally

#### Scenario: Budget is exhausted between stages

- **WHEN** a stage completes, recorded usage has reached the ceiling, and a
  further stage would otherwise follow
- **THEN** the chain stops without starting it, and reports the budget as
  the reason rather than a failure of the work

#### Scenario: A run exceeds the ceiling on its own

- **WHEN** a single run's reported usage carries the total past the ceiling
- **THEN** that run is not interrupted, and the ceiling takes effect before
  the next stage starts

#### Scenario: No usage was reported

- **WHEN** runs for a change carry no reported usage
- **THEN** nothing is counted against the ceiling, and no estimate is
  substituted

#### Scenario: No ceiling is configured

- **WHEN** no ceiling is configured
- **THEN** stages and chains proceed exactly as they would without this
  requirement
