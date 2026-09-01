## ADDED Requirements

### Requirement: A process may wait on an external signal without holding the workspace mutation lock

A running process SHALL be able to suspend itself while it waits for a
signal from outside the workspace. While suspended it SHALL NOT hold the
workspace mutation lock, and the system SHALL admit other mutating work in
its place.

A suspended process SHALL record what it is waiting for.

Resuming a suspended process SHALL return it to the queue rather than
returning it directly to running, so that no two processes may hold the
mutation lock at once.

#### Scenario: Other work proceeds while a process waits

- **WHEN** a mutating process suspends to wait for an external signal
- **THEN** another mutating process may start and finish while it waits

#### Scenario: A suspended process is resumed

- **WHEN** a suspended process receives the signal it was waiting for
- **THEN** it returns to the queue and runs again once the mutation lock
  is available

#### Scenario: Two processes suspended at once

- **WHEN** two suspended processes are resumed together
- **THEN** they run one after another, never concurrently

#### Scenario: A suspended process is cancelled

- **WHEN** a suspended process is cancelled
- **THEN** it ends as cancelled without waiting for its signal

### Requirement: Every suspension is bounded and reported when it expires

A suspension SHALL have a maximum duration. When it elapses without the
signal arriving, the process SHALL fail, and the failure SHALL name what
the process was waiting for.

#### Scenario: The signal never arrives

- **WHEN** a suspension's maximum duration elapses before its signal
- **THEN** the process fails with a reason naming what it awaited, and the
  mutation lock is available to the next queued process

### Requirement: Cross-host exclusion follows the suspension

Where the system holds a cross-host claim on the workspace for a mutating
process, suspending that process SHALL release the claim, and resuming it
SHALL require the claim to be reacquired before it runs again.

A resumed process that cannot reacquire the claim SHALL wait rather than
proceed without it.

#### Scenario: Another host may work while a process waits

- **WHEN** a mutating process holding the cross-host claim suspends
- **THEN** the claim is released

#### Scenario: The claim is unavailable at resume

- **WHEN** a resumed process cannot reacquire the cross-host claim
- **THEN** it waits in the queue and does not run

### Requirement: A suspension does not survive a host restart

When the system loads persisted process history, a process recorded as
suspended SHALL be reported as interrupted, with a reason stating that the
host awaiting its signal is gone.

#### Scenario: Restart with a suspended process on record

- **WHEN** process history containing a suspended process is loaded
- **THEN** that process is reported as interrupted, and is not awaiting
  any signal

### Requirement: A waiting process is presented as waiting

A suspended process SHALL be presented distinctly from a running one,
together with what it is waiting for, and SHALL NOT be counted as making
progress.

#### Scenario: A suspended process in the process list

- **WHEN** a suspended process is shown
- **THEN** it is shown as waiting, with what it awaits, and not as running
