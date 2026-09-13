## ADDED Requirements

### Requirement: A run elsewhere can be asked to stop through the channel

A person SHALL be able to ask a run that another process started to stop.
The request SHALL be a signed file written into the directory beside the
repository's working directories, addressed to that run's instance
identity, and carrying a reason, the time it was sent, and an identifier of
its own.

Nothing SHALL be written into the run's working directory in order to ask.

#### Scenario: Asking from another working directory

- **WHEN** a person asks a run in another working directory to stop
- **THEN** a signed request addressed to that run is written beside the
  working directories, and no file inside the run's working directory is
  written

### Requirement: A run acts on a request to stop only when it is verified, fresh and new

A run SHALL read the requests addressed to it each time it renews its
record.

It SHALL act on a request that is verified, is not older than the freshness
window, and has not already been seen, as a stop asked of it by the enrolled
person.

It SHALL NOT act on a request that is unverified, does not check out, is
stale, or has already been seen. Where it does not act on a request whose
signature checks out, it SHALL say so once in its record and SHALL record it
in the audit log.

A request's contents SHALL be read only after its signature verifies. A
request whose signature does not check out SHALL NOT be attributed to any
run, and SHALL be reported to whoever reads the channel.

#### Scenario: A verified request

- **WHEN** a verified, fresh request addressed to a run arrives
- **THEN** the run is asked to stop, and names the enrolled person who asked

#### Scenario: The same request again

- **WHEN** a request that the run has already acted on arrives again
- **THEN** it is not acted on a second time

#### Scenario: An unverified request

- **WHEN** a request is signed by a key that is not enrolled
- **THEN** it is not acted on, and the run's record says that a request
  arrived and was not acted on

#### Scenario: A stale request

- **WHEN** a request older than the freshness window arrives
- **THEN** it is not acted on

#### Scenario: A request that does not check out

- **WHEN** a request's contents were changed after it was signed
- **THEN** no run acts on it or reports it as its own, and reading the
  channel reports it
