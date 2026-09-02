## ADDED Requirements

### Requirement: Audit records outlive the process that wrote them

The system SHALL persist audit records for a workspace, and SHALL read
them back after a restart.

Persisted records SHALL be readable by any host operating on that
workspace, so that a limit computed from recorded history spans a
change's runs rather than one session's.

#### Scenario: A run recorded, then a restart

- **WHEN** a run is recorded and the host is restarted
- **THEN** that run's audit record is still available

#### Scenario: A limit computed after a restart

- **WHEN** a spending ceiling is evaluated after a restart
- **THEN** it counts runs recorded before that restart

### Requirement: The audit record is bounded

Persisted audit records SHALL be bounded in size. When the bound is
exceeded, the oldest records SHALL be discarded and the newest retained.

The whole record SHALL NOT be discarded on reaching the bound.

#### Scenario: The bound is exceeded

- **WHEN** persisted records exceed the configured bound
- **THEN** the oldest are discarded, the newest remain, and the record is
  not emptied

### Requirement: An unreadable record degrades rather than failing a run

Reading persisted audit records SHALL tolerate an incomplete or
unparseable record: such a record is skipped and the remaining records are
returned.

Where no persisted records exist, reading SHALL report none rather than
failing.

Recording SHALL NOT block the run it describes, and a failure to record
SHALL NOT fail that run.

#### Scenario: A record was interrupted mid-write

- **WHEN** persisted records end with an incomplete entry
- **THEN** every complete entry before it is returned

#### Scenario: Nothing has been recorded yet

- **WHEN** no persisted records exist
- **THEN** reading reports none, without error

#### Scenario: Recording fails

- **WHEN** an audit record cannot be written
- **THEN** the run it describes proceeds unaffected
