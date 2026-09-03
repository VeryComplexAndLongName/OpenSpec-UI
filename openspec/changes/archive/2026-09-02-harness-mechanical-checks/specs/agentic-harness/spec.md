## ADDED Requirements

### Requirement: A task may declare a check the system performs itself

A task SHALL be able to declare a check by name, from a set the system
defines. A task that declares none SHALL behave exactly as it does
without this capability.

The system SHALL perform a declared check itself and SHALL record its
result on that task. An agent's report SHALL NOT record a result for a
task that declares a check.

A declared name the system does not define SHALL be reported as an error
naming the unknown check and the ones it defines, rather than being
ignored.

#### Scenario: A declared check passes

- **WHEN** a task declares a check and that check passes
- **THEN** the task is recorded as done, without an agent being asked
  about it

#### Scenario: A declared check fails

- **WHEN** a task declares a check and that check fails
- **THEN** the task is not recorded as done, and the failure names what
  was checked and what came back

#### Scenario: An agent reports a checked task as done

- **WHEN** an agent reports that a task declaring a check is done, and
  the check did not pass
- **THEN** the task is not recorded as done

#### Scenario: A task declares no check

- **WHEN** a task declares no check
- **THEN** it is handled exactly as before this capability existed

#### Scenario: An unknown check name

- **WHEN** a task declares a check the system does not define
- **THEN** it is reported as an error naming the unknown check and the
  defined ones

### Requirement: A change may only select from checks the system defines

The system SHALL NOT accept a command, an argument list, or any other
executable text from a change's files as a check.

Where a check takes a location, that location SHALL be confined to the
workspace.

#### Scenario: A location outside the workspace

- **WHEN** a declared check names a location outside the workspace
- **THEN** it is refused

### Requirement: Declared checks run before the verifying agent

Where a stage both performs declared checks and invokes an agent, the
checks SHALL run first.

If any declared check fails, that stage SHALL NOT invoke its agent, and
SHALL report which checks failed.

Where all declared checks pass, their results SHALL be available to that
agent, so that it need not repeat them.

#### Scenario: A check fails before the agent runs

- **WHEN** a declared check fails during a stage that would otherwise
  invoke an agent
- **THEN** no agent is invoked and the failing checks are named

#### Scenario: All checks pass

- **WHEN** every declared check passes
- **THEN** the agent is invoked and is told what has already been
  established

### Requirement: A stage that invokes no agent offers none to configure

Where a stage performs a mechanical operation rather than invoking an
agent, the configuration SHALL NOT accept an agent for it, and no surface
SHALL offer one.

Such a stage SHALL still be presented as part of the sequence, because it
runs.

A configuration that already names an agent for such a stage SHALL be
accepted, with that entry discarded and reported, rather than refused.

#### Scenario: Configuring an agent for a mechanical stage

- **WHEN** a configuration names an agent for a stage that invokes none
- **THEN** the configuration is accepted, that entry is discarded, and
  the discard is reported

#### Scenario: Presenting the stages

- **WHEN** the stages are presented for configuration
- **THEN** a mechanical stage appears among them without an agent choice
