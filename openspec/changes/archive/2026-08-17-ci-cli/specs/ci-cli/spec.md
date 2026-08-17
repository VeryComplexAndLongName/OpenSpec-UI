## ADDED Requirements

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
