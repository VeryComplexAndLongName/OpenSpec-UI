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

### Requirement: The browser suite does not depend on apt sources it never reads

Installing the browser suite's system dependencies SHALL NOT fail
because of an apt source this repository installs nothing from.

The runner image carries third-party sources; `--with-deps` reads all of
them through `apt-get update`, so a bad publish anywhere on the image
fails an install that has nothing to do with it. Observed three times
across half an hour on 2026-09-09, all from Google's Chrome repository,
which this job never installs a package from.

The system dependencies themselves SHALL still be installed. The source
is what is removed, never the check that the libraries Chromium needs
are present.

#### Scenario: A third-party repository failing to publish

- **WHEN** an apt source on the runner image serves an index that does
  not match its hashes
- **THEN** the browser install still succeeds, because that source is
  not read

#### Scenario: The dependencies Chromium needs

- **WHEN** the browser is installed in CI
- **THEN** its system dependencies are installed with it

### Requirement: A change can be run from a terminal

The CLI SHALL accept a command that runs one named change through the
Agentic Harness chain, resolving that change's harness configuration and
dispatching on it exactly as an interactive host does.

The run SHALL use the same chain, the same agent allowlist, the same
working-directory sandbox and the same audit log as a run started from
either interactive host. A run started here SHALL be visible to them:
recorded in the workspace's audit log, counted against the same spending
totals, and subject to the same configured ceilings.

The process SHALL exit `0` where the chain completed, `1` where the
change did not complete — a stage failed, the change's declared checks
failed, or the run was cancelled — and `2` where the CLI declined to
start or could not start. The reason SHALL be printed in every non-zero
case, so the code never has to be interpreted on its own.

#### Scenario: A change whose configuration permits an unattended chain

- **WHEN** a change whose resolved configuration runs without asking
  anything is named
- **THEN** the chain runs, its events are printed as they arrive, and the
  process exits `0` on completion

#### Scenario: A stage fails

- **WHEN** a stage of the chain fails
- **THEN** the process exits `1` and the failure's reason is printed

#### Scenario: The run is recorded

- **WHEN** a chain is run from the terminal
- **THEN** its agent invocations appear in the same workspace audit log
  an interactive host writes to

### Requirement: The terminal never lowers a gate

The CLI SHALL run only what the change's resolved configuration already
permits, and SHALL provide no option that permits more.

There SHALL be no flag that starts a chain for a change whose autonomy
level does not have one, and no flag that answers a confirmation the
configuration asked for. Where a run cannot proceed, the refusal SHALL
name the configuration key that governs it, so the reader is routed to
the file where the decision belongs.

A confirmation the configuration asks for SHALL be put to a person on
the terminal's input. Where that input is not a terminal, there is
nobody to ask, and the run SHALL be refused.

#### Scenario: A change that has no chain

- **WHEN** a change whose autonomy level starts stages individually is
  named
- **THEN** the run is refused, the reason names that level, and the
  process exits `2`

#### Scenario: A confirmation with a person present

- **WHEN** the chain reaches a point the configuration says to confirm,
  and input is a terminal
- **THEN** the choice is put to the person, and their answer continues or
  ends the chain

#### Scenario: A confirmation with nobody present

- **WHEN** a change's configuration asks for confirmations and input is
  not a terminal
- **THEN** the run is refused, the refusal names the setting that would
  make the change runnable unattended, and the process exits `2`

### Requirement: A refusal costs nothing

Every condition that prevents a run SHALL be checked before the first
stage starts.

This SHALL include the agent each stage would use. Where a stage names an
agent this build cannot resolve to a runner, the whole run SHALL be
refused up front, naming the stage and the agent, rather than failing
when the chain reaches that stage.

A run refused for any reason SHALL have invoked no agent and modified no
file in the change.

#### Scenario: A later stage names an unavailable agent

- **WHEN** a change's configuration names an agent this build does not
  have for a stage that is not the first
- **THEN** the run is refused before the first stage, the message names
  the stage and the agent, and no agent was invoked

### Requirement: A run is streamed, not summarised

Output SHALL be written as the run produces it, in both formats.

The default format SHALL be human-readable text naming each stage, the
agent performing it, and the output as it arrives. Text from an agent
that streams its reply in slices SHALL be joined as it is in the
interactive surfaces, rather than printed one slice per line.

The machine-readable format SHALL be one JSON object per line, each the
event as published. It SHALL NOT be a single document written at the end:
a run's output has to be readable while the run is still going.

#### Scenario: Reading a run as it happens

- **WHEN** a chain is running
- **THEN** each stage's output appears as it is produced, before the run
  finishes

#### Scenario: A machine reads the same run

- **WHEN** the machine-readable format is selected
- **THEN** each event is printed as its own line, parseable on its own,
  as it happens

### Requirement: A terminal run holds the workspace to itself

A run started from a terminal SHALL take the same cross-host workspace
lease an interactive host takes, identifying itself as its own kind of
host, and SHALL release it when the run reaches a terminal state.

Where another host holds the workspace, the run SHALL be refused with a
message naming that holder, rather than mutating a workspace another host
is mutating.

A host reading a lease SHALL describe its holder correctly for every kind
of host that can take one.

#### Scenario: Another host is working

- **WHEN** a run is requested while an interactive host holds the lease
- **THEN** the run is refused, the message names the holder, and no stage
  starts

#### Scenario: An interrupted run

- **WHEN** the run is interrupted from the keyboard
- **THEN** the chain is cancelled, the agent's process tree is
  terminated, and the lease is released

### Requirement: A change's declared checks can be run on their own

The CLI SHALL accept a command that runs the mechanical checks a change's
`tasks.md` declares and reports each one's outcome and reason.

It SHALL invoke no agent and spend nothing. The checks it runs SHALL be
the ones the change declares, selected from the closed registry the core
owns; the CLI SHALL neither add to that registry nor accept a check named
on its command line.

A change declaring no checks SHALL be reported as declaring none and SHALL
exit `0`. Declaring no checks is not a failure of the change.

#### Scenario: A change whose checks pass

- **WHEN** the checks a change declares all pass
- **THEN** each is reported with its reason and the process exits `0`

#### Scenario: A change whose checks do not all pass

- **WHEN** at least one declared check fails
- **THEN** every check's outcome is still reported, the failing one names
  what came back, and the process exits `1`

#### Scenario: A change that declares no checks

- **WHEN** a change declaring no mechanical checks is named
- **THEN** the report says so and the process exits `0`

