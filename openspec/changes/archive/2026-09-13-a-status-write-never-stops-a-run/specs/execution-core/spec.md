## ADDED Requirements

### Requirement: Reporting what a run is doing never stops the run

A failure to write, renew or remove a run's record SHALL NOT end the run,
and SHALL NOT reach it as an error.

A run's record SHALL be written one write at a time.

A write refused because the record's name is momentarily in use SHALL be
retried a bounded number of times, and the record SHALL NOT be removed to
make room for it.

No write of a run's record SHALL land after the run has removed that
record on a clean end.

#### Scenario: The record cannot be written at a renewal

- **WHEN** renewing a run's record fails
- **THEN** the run continues, and the next renewal tries again

#### Scenario: A renewal falls due during another write

- **WHEN** a renewal falls due while the record is being written
- **THEN** the two writes happen one after the other

#### Scenario: The record's name is momentarily in use

- **WHEN** replacing the record is refused because its name is in use
- **THEN** the write is retried, and the previous record stays readable
  meanwhile

#### Scenario: A run ends while its record is being written

- **WHEN** a run ends cleanly while a write of its record is under way
- **THEN** no record of that run remains afterwards
