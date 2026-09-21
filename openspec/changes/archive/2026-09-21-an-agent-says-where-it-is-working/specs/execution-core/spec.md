## ADDED Requirements

### Requirement: An agent working on the repository is visible whether or not it is a run

An agent that works on the repository SHALL be able to report itself into
the same status directory a run reports into, with the same signed,
heartbeating record: who it is, which working directory it is in, and what
it is doing.

A reader SHALL NOT need to distinguish such a record from a run's in order
to show it, and a record SHALL expire by the same staleness window a run's
record expires by.

#### Scenario: Two agents on one machine

- **WHEN** two agents are working in two working directories of one
  repository
- **THEN** each can read the other's record, and a host that lists runs
  lists both

#### Scenario: An agent that stops reporting

- **WHEN** an agent's record is not renewed within the staleness window
- **THEN** it reads as gone, as a run's record does

### Requirement: A shared resource on one machine can be claimed

A resource that is not a working directory - this machine's browser
capture suite, a port, the editor under test - SHALL be claimable by a
signed record beside the status directory, naming the claimant, the
resource and when it was taken, and renewed by a heartbeat.

An agent that finds a resource claimed SHALL wait a bounded time, SHALL
say whom it is waiting for while it waits, and SHALL report rather than
proceed when the wait runs out.

A claim SHALL expire when its heartbeat stops, and SHALL NOT be enforced
against an agent that does not ask for it: it makes a collision visible
and attributable, and the operating system owns enforcement.

#### Scenario: A resource already held

- **WHEN** an agent asks for a resource another agent holds
- **THEN** it is told who holds it and since when, waits a bounded time
  saying so, and reports rather than proceeding if the wait runs out

#### Scenario: A claimant that dies

- **WHEN** a claimant stops renewing its claim
- **THEN** the claim expires by the staleness window and the resource can
  be taken

#### Scenario: Two agents asking at once

- **WHEN** two agents ask for the same free resource at the same moment
- **THEN** exactly one holds it, and the other reads the holder's record
