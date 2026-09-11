## ADDED Requirements

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
