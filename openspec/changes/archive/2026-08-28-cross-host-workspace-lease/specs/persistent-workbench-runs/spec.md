## MODIFIED Requirements

### Requirement: Workspace mutation isolation

The Workbench SHALL run at most one mutating process in a workspace at a
time until mutations have independent filesystem isolation, whether both
attempts originate in the same host process or in two different host
processes (for example, a VS Code extension host and a standalone
server) pointed at the same workspace root. Cross-process isolation
SHALL be enforced by a versioned, workspace-local lease file that the
running host renews while a mutating process is active and releases
when that process reaches a terminal state; a lease whose last renewal
is older than a bounded staleness window SHALL be treated as no longer
held. Read-only runs SHALL remain unaffected by the lease.

#### Scenario: Different changes mutate the same workspace

- **WHEN** mutating runs for two different changes are requested
- **THEN** the second run remains queued until the first reaches a terminal
  state
- **AND** read-only runs may execute concurrently

#### Scenario: A second host attempts to mutate the same workspace

- **WHEN** a mutating run is requested on a host that does not hold the
  current workspace lease, and that lease is not stale
- **THEN** the run fails immediately, reporting which other host
  currently holds the lease
- **AND** no process record is left queued waiting for the other host to
  finish

#### Scenario: The lease holder releases on completion

- **WHEN** a mutating run reaches a terminal state
- **THEN** its host releases the workspace lease
- **AND** a subsequent mutating run, from either host, may acquire it
  immediately

#### Scenario: The previous lease holder is no longer active

- **WHEN** a host requests a mutating run and the existing lease's last
  renewal is older than the staleness window
- **THEN** the host acquires the lease and proceeds
- **AND** the reclamation is disclosed rather than silently overwritten
