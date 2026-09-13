## ADDED Requirements

### Requirement: A run's status record holds no history

A run's status record SHALL describe only the present: what the run is
doing, and when it last reported.

It SHALL be replaced on each write rather than extended.

What a run did SHALL be recorded in the audit log when it happens, and
SHALL NOT be kept in the status record for collection later.

#### Scenario: A run that crashes

- **WHEN** a run stops without removing its status record
- **THEN** everything it did up to that point is already in the audit
  log, and its status record holds nothing that is not

### Requirement: A record whose writer is gone is removed

A status record whose heartbeat is older than the staleness window SHALL
be removed by a sweep.

A record SHALL be removed only if it is still past the window when read
again immediately before removal.

A record whose writer is still reporting SHALL NOT be removed.

Reading status SHALL NOT remove anything; sweeping SHALL be a separate
operation that reports what it removed.

#### Scenario: A run that crashed hours ago

- **WHEN** a sweep finds a record whose heartbeat is past the window
- **THEN** the record is removed and the sweep reports it

#### Scenario: A slow writer renews in time

- **WHEN** a record read as stale has been renewed by the time it is
  read again
- **THEN** it is not removed

#### Scenario: Reading does not change the directory

- **WHEN** status is read
- **THEN** no record is removed by the reading

### Requirement: A write that never finished leaves nothing behind for good

A temporary file left by a status write that did not complete SHALL be
removed by a sweep once it is older than the staleness window.

#### Scenario: A process that died mid-write

- **WHEN** a sweep finds a temporary status file older than the window
- **THEN** it is removed

### Requirement: A malformed record is kept

A status record that cannot be read, lacks required fields, or names an
identity other than its own SHALL NOT be removed by a sweep.

It SHALL continue to be reported as malformed.

#### Scenario: A record under the wrong identity

- **WHEN** a sweep finds a record whose identity does not match its name
- **THEN** the record is left in place and still reported
