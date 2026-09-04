## ADDED Requirements

### Requirement: The dependency audit is a check of its own

The repository SHALL audit its production dependencies for high-severity
advisories as a check that no other check depends on, so that the result
of the audit cannot decide whether the rest of CI runs.

Where the audit fails, the remaining checks SHALL still run and report
their own results.

#### Scenario: The audit fails

- **WHEN** the dependency audit reports a failure
- **THEN** the other checks still run, and each reports its own result

#### Scenario: Another check fails

- **WHEN** a different check fails
- **THEN** the dependency audit still runs and reports its own result

### Requirement: An audit that could not run is not reported as a finding

Where the audit cannot be carried out — the advisory service is
unreachable, returns an error, or does not answer within a bounded time —
the system SHALL report that it could not be carried out, and SHALL NOT
report it as a failing check.

Where the audit is carried out and finds a high-severity advisory, the
system SHALL fail its check.

An audit that could not be carried out SHALL NOT be presented as an audit
that found nothing.

#### Scenario: The advisory service is unavailable

- **WHEN** the audit cannot reach the advisory service
- **THEN** the check does not fail, and the run says the audit could not
  be carried out

#### Scenario: The advisory service does not answer in time

- **WHEN** the audit exceeds its bounded waiting time
- **THEN** it stops waiting, the check does not fail, and the run says
  the audit could not be carried out

#### Scenario: A high-severity advisory exists

- **WHEN** the audit is carried out and finds a high-severity advisory
- **THEN** its check fails
