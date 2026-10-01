## MODIFIED Requirements

### Requirement: A card starts its change through the run dialog

A card whose change can start SHALL offer Start. Start SHALL open the run
dialog for that change, and SHALL NOT start a run by itself.

A change whose every task is done can start: a run of it continues at
`verify`. Its card SHALL offer Start.

A card whose change cannot start SHALL NOT offer Start.

#### Scenario: A ready change

- **WHEN** Start is used on the card of a ready change
- **THEN** the run dialog opens for that change, and no run starts until a
  path is chosen in it

#### Scenario: A blocked change

- **WHEN** a change is blocked
- **THEN** its card offers no Start

#### Scenario: A change whose every task is done

- **WHEN** every task of a change is done, and no run of it is live
- **THEN** its card offers Start, and the run dialog it opens says the run
  continues at verify

## ADDED Requirements

### Requirement: A stage says what it checks

Wherever a surface names a chain stage for a person to choose or read - the
Harness Settings stage table and the run dialog's list of what runs each
stage - it SHALL say in words what that stage does. `review` SHALL read as
reviewing the proposal, before apply; `verify` SHALL read as checking the
implementation, after apply. The words SHALL come from core, so no two
surfaces say it differently.

DW took `review` for a review of the implementation (2026-09-26): the name
alone does not say which of the two stages that check work comes first.

#### Scenario: The run dialog

- **WHEN** the run dialog lists what runs each stage
- **THEN** the `review` line says it reviews the proposal, before apply, and
  the `verify` line says it checks the implementation, after apply

#### Scenario: The Harness Settings stage table

- **WHEN** the stage table is drawn
- **THEN** each stage's name is followed by what that stage does

#### Scenario: A skipped stage

- **WHEN** the resolved configuration's `skipStages` names `review`
- **THEN** the run dialog lists `review` as skipped, and the stage table
  says the stage is skipped

### Requirement: The command list says what each command does

The command list SHALL say, beside each command's name as the list shows
it, what the command does. A stage SHALL be named as OpenSpec names it,
and where the command it sends is named differently, its words SHALL say
which command is sent: `propose` is sent as `plan`, and `apply` as
`implement`. The words SHALL come from core.

#### Scenario: The command picker

- **WHEN** the command picker is opened
- **THEN** each option reads as its name and what it does, and the
  `propose` option says it writes the change's missing planning artifacts
  and is sent as `plan`
