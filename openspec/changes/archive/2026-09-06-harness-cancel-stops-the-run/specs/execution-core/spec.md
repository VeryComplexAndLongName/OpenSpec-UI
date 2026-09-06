## ADDED Requirements

### Requirement: A cancel command stops the run it names

A command of kind `cancel` SHALL stop the run identified by its run id.

Handling a cancel command SHALL NOT start an agent: it SHALL NOT build an
invocation, SHALL NOT launch a process, and SHALL NOT record the start of
a run.

A cancel command naming a run the system does not have SHALL be reported
as cancelled and SHALL NOT be reported as an error, because a run may end
between the moment cancellation is requested and the moment it arrives.

#### Scenario: Cancelling a running run

- **WHEN** a cancel command names a run that is currently running
- **THEN** that run stops and is reported as cancelled

#### Scenario: Cancelling costs no agent run

- **WHEN** a cancel command is handled
- **THEN** no agent invocation is built, no agent process is started, and
  no run start is recorded for the cancel itself

#### Scenario: Cancelling a run that is already over

- **WHEN** a cancel command names a run the system does not have
- **THEN** it is reported as cancelled, without an error

### Requirement: A running agent process can be terminated

The system SHALL be able to terminate an agent process it started, and
SHALL terminate the processes that process itself started, not only the
process it launched directly.

A run terminated this way SHALL end as cancelled, distinctly from a run
that failed on its own.

After termination the run SHALL emit no further output, and SHALL report
exactly one terminal outcome.

#### Scenario: A run is terminated part-way

- **WHEN** a running agent's run is cancelled
- **THEN** the agent's process is terminated and the run ends as
  cancelled, not as failed

#### Scenario: The agent was launched through an intermediate process

- **WHEN** the agent was launched through an intermediate process, as on
  a platform where the agent is installed as a shim
- **THEN** terminating the run terminates the agent itself, not only the
  intermediate process

#### Scenario: Output buffered at the moment of cancellation

- **WHEN** a run is cancelled while output it produced is still buffered
- **THEN** no output is reported after the terminal outcome, and the
  terminal outcome is reported once

#### Scenario: Cancellation requested before the process starts

- **WHEN** a run is cancelled before its process is launched
- **THEN** no process is launched and the run is reported as cancelled
