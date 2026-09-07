## ADDED Requirements

### Requirement: A failing merge gate states the reason the tool gave

Where the underlying `openspec` CLI reports why a change did not pass,
the aggregated report SHALL carry that reason.

An invalid change SHALL be reported as invalid — with its issues and its
counts — and not as a change that could not be validated. The two are
different findings: the first says fix the change, the second says
something is wrong with the tooling or the directory, and a reader acts
differently on each.

Where the tool exits non-zero but prints the report it was asked for,
that report SHALL be used. The exit code SHALL remain the signal only
where there is no report to read.

A reason consisting solely of runtime noise — a warning banner, a
deprecation notice — is not a diagnosis. Where no diagnosis can be
recovered, the report SHALL say that rather than presenting noise as an
explanation.

#### Scenario: A change fails strict validation

- **WHEN** the underlying CLI exits non-zero for a change and prints its
  report, naming what is wrong
- **THEN** that change is reported as invalid, carrying the reported
  issues and counts rather than an opaque error

#### Scenario: The tool writes a warning to its error stream

- **WHEN** the underlying CLI's runtime prints a warning while also
  printing a usable report
- **THEN** the reported reason is the diagnosis, not the warning

#### Scenario: Nothing usable was produced

- **WHEN** the underlying CLI exits non-zero and prints no report that
  can be read
- **THEN** the change is reported as one that could not be validated, and
  the reason states that no diagnosis was reported

#### Scenario: The exit-code contract is unchanged

- **WHEN** any of the above occurs
- **THEN** the process still exits `1` for a validation failure and `2`
  only where the check itself could not run
