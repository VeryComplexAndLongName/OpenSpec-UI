## ADDED Requirements

### Requirement: A run reports what it is doing

A run SHALL record what it is currently doing, which change and working
directory it is doing it in, and a heartbeat, in a place readable by
anything that can read the repository's working directories.

The record SHALL be written where no working directory's removal
destroys it.

It SHALL be written such that a partially written record is never read
as a complete one.

#### Scenario: A run in progress

- **WHEN** a run is under way
- **THEN** what it is doing, and when it last said so, can be read
  without asking the run anything

#### Scenario: A run whose working directory is removed

- **WHEN** the working directory a run used is removed
- **THEN** what was recorded about that run is unaffected by the removal

### Requirement: Each run writes only its own record

A run's record SHALL be identified by the run itself, and SHALL NOT be
identified by the person running it: one person may have several runs at
once, and they would otherwise share one record.

The identity SHALL also be carried inside the record, so that a record
found under the wrong identity is reported rather than accepted.

#### Scenario: Two runs by one person

- **WHEN** one person has two runs under way at once
- **THEN** each has its own record and neither overwrites the other

#### Scenario: A record found under an identity that is not its own

- **WHEN** a record's stated identity does not match where it was found
- **THEN** it is reported as such rather than read as that run's

### Requirement: A run that stopped reporting is treated as gone

A record whose heartbeat is older than the staleness window SHALL mean
its writer is gone.

The window SHALL be the one the workspace lease already uses; a second
meaning of "gone" SHALL NOT be introduced.

#### Scenario: A run that ended without tidying up

- **WHEN** a run's record stops being renewed
- **THEN** after the staleness window it reads as a run that is gone

### Requirement: How long since a run said anything is reported, and no verdict is drawn

It SHALL be reported how long it has been since a run last said what it
was doing.

It SHALL NOT be reported that a run is stuck, hung, or unhealthy. A long
period of work produces the same silence, and which of the two it is, is
a judgement for a person.

#### Scenario: A run that has not said anything for a long time

- **WHEN** a run's heartbeat continues but what it reports doing has not
  changed
- **THEN** the interval is reported, and no conclusion about the run's
  health is stated

#### Scenario: A run working normally

- **WHEN** a run reports a new activity
- **THEN** the interval begins again from that moment
