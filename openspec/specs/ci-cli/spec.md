# ci-cli Specification

## Purpose
TBD - created by archiving change ci-cli. Update Purpose after archive.
## Requirements
### Requirement: `validate` command checks every active change and aggregates the result

The CLI SHALL list every active OpenSpec change in the given workspace,
run strict validation on each, and print a single aggregated report
(`{ ok, results: [...] }` in JSON by default, an equivalent table with
`--format text`). `ok` SHALL be `true` if and only if every change's
`valid` field is `true`.

#### Scenario: All active changes are valid

- **WHEN** `validate` runs against a workspace where every active change
  passes strict validation
- **THEN** the process exits with code `0` and prints `ok: true` with one
  result entry per change

#### Scenario: At least one active change is invalid

- **WHEN** `validate` runs against a workspace where one or more active
  changes fail strict validation
- **THEN** the process exits with code `1`, `ok` is `false`, and the
  report still includes every change's result (not just the failing
  ones)

#### Scenario: A single change cannot be validated

- **WHEN** the underlying `openspec` CLI errors for one specific change
  (e.g. a corrupted change directory) while other changes list and
  validate normally
- **THEN** that change's result carries `valid: false` and an `error`
  message, the run still completes and reports every other change, and
  the process exits with code `1` (not `2`)

#### Scenario: The check itself cannot run

- **WHEN** listing active changes fails entirely (e.g. the `openspec` CLI
  is not installed, or the workspace has no OpenSpec root)
- **THEN** the process prints a clear error to stderr and exits with code
  `2`, distinct from a validation failure

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

