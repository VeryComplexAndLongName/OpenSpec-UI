## ADDED Requirements

### Requirement: A change may declare additional steps in its chain

A change's own harness configuration MAY declare steps that the chain
runs in addition to its fixed stages.

Each declared step SHALL name an entry in a registry the core owns, and
SHALL state its position as being before or after one fixed stage —
exactly one of the two, naming exactly one stage.

A declaration SHALL NOT name something to execute. The name selects a
behaviour this system implements; a configuration file supplies data and
never supplies a command, an argument vector, or a path to run.

Steps SHALL be declarable only in a change's own configuration. A
workspace-wide declaration is a statement about changes it knows nothing
about, and SHALL be refused with its own error.

#### Scenario: A step declared before a stage

- **WHEN** a change declares a step positioned before a fixed stage
- **THEN** the chain runs that step immediately before that stage

#### Scenario: A step naming nothing the registry has

- **WHEN** a declaration names a step the registry does not contain
- **THEN** the configuration is refused, and the message lists the names
  that are valid

#### Scenario: A declaration stating both positions, or neither

- **WHEN** a declaration states both a before and an after position, or
  states neither
- **THEN** the configuration is refused

#### Scenario: A workspace-wide declaration

- **WHEN** the workspace-wide harness configuration declares steps
- **THEN** it is refused, distinctly from other configuration errors

### Requirement: The fixed stages stay fixed

A declaration SHALL NOT remove a fixed stage, replace one, or change the
order they run in. It inserts only.

A chain's fixed sequence is what lets somebody who has watched one
change's run read another's. A change able to delete a stage would
produce a transcript that means something different from every other
transcript, and could not be read without first opening that change's
configuration.

#### Scenario: Every fixed stage still runs

- **WHEN** a change declares steps and its chain runs
- **THEN** each fixed stage the chain would have run still runs, in the
  order it always did

### Requirement: A declared step is a part of the chain's own timeline

A step SHALL be reported through the same events, in the same sequence,
as the stages around it — announced when it starts and reported when it
finishes, naming itself.

A surface that renders a chain SHALL NOT need to recognise a step to
render the run coherently.

A step that fails SHALL end the chain, in the same way a failing stage
does.

#### Scenario: Watching a chain that has a declared step

- **WHEN** a chain with a declared step runs
- **THEN** the step appears in the transcript between the stages it was
  declared between, naming itself

#### Scenario: A step that does not succeed

- **WHEN** a declared step fails
- **THEN** the chain ends, and the reason states which step failed and
  what it was doing

### Requirement: A chain may wait for another change to land

The registry SHALL provide a step that waits until a named change is no
longer active in the workspace.

The wait SHALL have a bounded maximum duration. Exceeding it SHALL fail
the chain with a reason naming the change that was waited for and how
long the wait was given.

A change SHALL NOT be able to wait for itself.

#### Scenario: The awaited change lands

- **WHEN** a chain reaches a step waiting on another change, and that
  change is archived while it waits
- **THEN** the wait ends and the chain continues to the next stage

#### Scenario: The awaited change has already landed

- **WHEN** the change a step waits on is already not active when the step
  begins
- **THEN** the step finishes without waiting

#### Scenario: The wait runs out

- **WHEN** the awaited change has not landed within the wait's maximum
  duration
- **THEN** the chain fails, naming the change and the duration

#### Scenario: A change waiting on itself

- **WHEN** a change declares a wait naming itself
- **THEN** the configuration is refused

### Requirement: Time spent waiting is not time spent running

The duration of a step that waits SHALL NOT count towards a chain's
configured run-time ceiling, and SHALL NOT count as spending against a
budget.

A chain waiting for something outside itself is not consuming anything,
in the same way a chain paused at a checkpoint is not. Counting it would
stop chains that are behaving exactly as they were configured to.

#### Scenario: A long wait under a run-time ceiling

- **WHEN** a chain with a run-time ceiling waits longer than that ceiling
  at a declared step, then continues
- **THEN** the ceiling is not reached by the waiting, and the chain
  proceeds

### Requirement: A declaration is checked before the chain starts

Every declared step SHALL be resolved before the first stage runs: its
name, its position, and whatever that entry requires of it.

A run whose declaration cannot be resolved SHALL be refused having
invoked no agent, rather than failing when the chain reaches the step.

Whether the thing a step waits for exists SHALL NOT be part of that
check. It may legitimately not exist yet — that is what the wait is for.

#### Scenario: A misspelled step name in a chain that would run agents first

- **WHEN** a change declares an unrecognised step positioned late in the
  chain
- **THEN** the run is refused before the first stage, and no agent was
  invoked

#### Scenario: Waiting on a change that has not been proposed yet

- **WHEN** a step names a change that does not exist in the workspace
- **THEN** the run is not refused for that reason
