## ADDED Requirements

### Requirement: A lease records who took it, as attribution

A workspace lease SHALL record the git identity of the working directory
that took it, where one is configured.

It SHALL be reported as what it is: a self-declared label, the same one
that signs the repository's commits, which anybody can set to anything.
Nothing SHALL be permitted or refused on the strength of it.

A lease taken where no identity is configured SHALL be valid and SHALL
record none, exactly as every lease written before this existed.

#### Scenario: A run in a working directory with a git identity

- **WHEN** a run takes the workspace in a directory that has a git
  identity configured
- **THEN** the lease records it, and a refusal naming the holder names
  it too

#### Scenario: No identity configured

- **WHEN** no git identity is configured
- **THEN** the lease is taken and records none

### Requirement: The holder of a workspace can be asked about

It SHALL be possible to ask who holds a workspace without attempting to
start a run.

The answer SHALL name the kind of host, where it is running, its process,
how long since it last reported itself, and its git identity where one
was recorded. Where nothing holds the workspace, it SHALL say so.

Asking SHALL succeed whether or not the workspace is held: the question
was answered either way.

#### Scenario: Asking about a held workspace

- **WHEN** the holder is asked for and a live lease exists
- **THEN** it is described, and the command reports success

#### Scenario: Asking about a free workspace

- **WHEN** nothing holds the workspace
- **THEN** it says so, and the command reports success

### Requirement: A lease is cleared only where its holder is shown to be gone

Clearing a lease SHALL require establishing that its holder is gone.

A heartbeat older than the staleness window establishes it — that is
what the lease has always meant by a holder no longer being there.

A holder on this same machine whose process is no longer running
establishes it. Checking SHALL NOT signal the process.

Where the holder is on another machine, or its process is still running,
clearing SHALL be refused, saying which of the two it was. Taking a lease
from a live holder would permit a second mutating run against files the
first still holds open, which is what the lease exists to prevent — and
a holder that is stuck is stopped, not robbed.

#### Scenario: A holder whose process has gone

- **WHEN** clearing is requested and the holder is on this machine with
  no such process running
- **THEN** the lease is cleared

#### Scenario: A holder that is still running

- **WHEN** clearing is requested and the holder's process is running
- **THEN** it is refused, and the message says the holder is alive and
  that stopping it is the remedy

#### Scenario: A holder somewhere else

- **WHEN** the holder is on another machine
- **THEN** clearing is refused, saying that it cannot be checked from
  here

#### Scenario: A lease already stale

- **WHEN** the heartbeat is older than the staleness window
- **THEN** the lease is cleared without needing to check any process
