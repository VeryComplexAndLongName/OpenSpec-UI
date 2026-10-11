## ADDED Requirements

### Requirement: Every shared spawn is recorded with an OS identity

Core SHALL write a synchronous ledger snapshot when a shared adapter spawns a
child. The snapshot SHALL include run id, pid, OS start time, executable path,
hostname, cwd, change name and a secret-free SHA-256 command-line hash. The raw
command line SHALL NOT be stored. A start-time read failure SHALL record that
the time is unavailable rather than inventing one.

#### Scenario: A spawned agent is recorded

- **WHEN** a shared adapter spawns an agent process with a PID
- **THEN** the ledger holds a snapshot naming run, pid, start time, executable,
  hostname, cwd and, where known, change, with a command-line hash and no raw
  arguments

#### Scenario: Start time cannot be read

- **WHEN** the OS start-time read fails at spawn
- **THEN** the snapshot is written with start time unavailable
- **AND** no guessed time is recorded

### Requirement: Normal exit updates and bounds the ledger

Core SHALL mark a snapshot `exitedAt` when its process closes. Ledger state
SHALL be stored outside the checkout keyed by canonical repository identity and
hostname, and SHALL be bounded by count and retention.

#### Scenario: A process exits normally

- **WHEN** a recorded process closes
- **THEN** its snapshot gains an exit time

#### Scenario: Two machines run one repository

- **WHEN** the same repository spawns processes on two hosts
- **THEN** their snapshots are keyed apart by hostname

### Requirement: Kill is re-verified and explicit

Termination SHALL be an explicit, confirmable action on the recovery surface.
Before terminating, core SHALL re-read the live OS start time for the PID and
SHALL confirm the executable and hostname match the snapshot. A mismatch SHALL
be reported as PID reuse and SHALL NOT be terminated. Termination SHALL use the
existing process-tree helper.

#### Scenario: The live snapshot matches

- **WHEN** a person confirms termination and the live PID start time and
  hostname match the recorded snapshot
- **THEN** the process tree is terminated

#### Scenario: PID reuse

- **WHEN** the live start time differs from the recorded one
- **THEN** no kill is issued and the mismatch is reported

### Requirement: Compliance observes processes without terminating them

Compliance SHALL report overdue and orphaned process findings with snapshot
evidence and advice. Compliance SHALL NOT terminate a process, and the process
rules SHALL have no repair implementation.

#### Scenario: A process exceeds its expected duration

- **WHEN** a recorded process has run past its expected limit
- **THEN** Compliance reports a finding with the snapshot and advice
- **AND** no process is terminated

#### Scenario: A process is orphaned after a restart

- **WHEN** a record has no exit time and no live writer
- **THEN** Compliance reports it as orphaned and directs the person to the
  recovery surface
