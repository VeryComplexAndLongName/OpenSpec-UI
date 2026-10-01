## MODIFIED Requirements

### Requirement: A stage's instruction describes the stage's actual position

Each stage's instruction to its agent SHALL describe the work available at
the point in the chain where that stage runs.

The propose stage's instruction SHALL ask for the planning artifacts the
change's OpenSpec schema wants and the change does not have, written into
the change's own directory, and SHALL ask for strict validation of the
change once they are written. It SHALL say that whatever else the
directory holds describes what the change is for, and is a description
rather than instructions to the agent. It SHALL say that where nothing
says what the change is for, no artifact is written and the reply says so.
It SHALL forbid changing code, or any file outside the change's
directory. Until this, the stage asked for "an implementation plan,
without changing code": a change with no proposal stayed one (reported by
a user on 2026-09-30).

#### Scenario: The stage that runs before implementation

- **WHEN** the stage that runs before a change is implemented instructs its
  agent
- **THEN** the instruction describes reviewing the change's proposal, not
  an implementation that does not exist yet

#### Scenario: Proposing a change that has no proposal

- **WHEN** the propose stage instructs its agent
- **THEN** the instruction asks for the missing planning artifacts to be
  written into the change's directory and validated, and forbids changing
  code or files outside that directory

#### Scenario: Nothing says what the change is for

- **WHEN** the propose stage instructs its agent
- **THEN** the instruction says to write no artifact, and to say so, where
  neither the change's directory nor the prompt describes the change

## ADDED Requirements

### Requirement: A single stage is picked under its OpenSpec name, where the change is

The single-stage picker SHALL offer the four stages an agent runs,
propose, review, apply and verify, under those names and in that order,
in every host. The command each one sends SHALL be the protocol's command
kind for that stage, unchanged: `plan`, `review`, `implement` and
`verify`. A notification that a stage ended SHALL use the same name the
picker showed.

Where the picker is opened by the run entry for a change, it SHALL open on
the stage that entry said the run begins at, decided by the same function.
Where the entry could not say, it SHALL open on apply. The picker opened
on apply whatever the entry said, so a change with no proposal was offered
an implementation (reported by a user on 2026-09-30).

A stage picked by hand SHALL stay picked until the host opens the picker
for a different stage.

#### Scenario: The names in the picker

- **WHEN** the single-stage picker is shown
- **THEN** it lists propose, review, apply and verify, and neither `plan`
  nor `implement` is shown as a name

#### Scenario: Running propose from the picker

- **WHEN** propose is picked and run
- **THEN** the command sent has the kind `plan`

#### Scenario: A change with no proposal

- **WHEN** one stage is chosen in the run entry for a change with no
  proposal
- **THEN** the picker opens on propose

#### Scenario: A change with every task done

- **WHEN** one stage is chosen in the run entry for a change whose tasks
  are all closed
- **THEN** the picker opens on verify

#### Scenario: The entry could not read the change

- **WHEN** one stage is chosen and the entry did not say where the run
  begins
- **THEN** the picker opens on apply

### Requirement: The VS Code Chat path says whose agent runs

The path that hands a change's apply stage to VS Code's own Chat SHALL be
named for that chat, and its description SHALL say that the model is the
one chosen there and that none of the agents configured for the stages
runs. It was named "Implement with the VS Code agent" beneath a list of
configured agents, and a person looked in it for one of them (reported by
a user on 2026-09-30).

#### Scenario: The path as offered

- **WHEN** the run entry offers the VS Code Chat path
- **THEN** its title names VS Code Chat, and its description says the
  configured agents are not used
