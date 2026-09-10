## ADDED Requirements

### Requirement: A run can be asked for at a time, and reports what became of it

A run SHALL be requestable for a time rather than for now, from the same
entry that starts one immediately.

Where the application is open at that time, the run SHALL start. Where it
is not, the run SHALL start when the application is next opened, and the
surface SHALL say how late it is.

A schedule that does not happen SHALL NOT be indistinguishable from one
that does. The entry SHALL say, before it is made, that it depends on the
application being open, and SHALL say afterwards when a run started later
than it was asked for.

A time already past SHALL be refused where it is entered rather than
accepted and fired at once.

Where several runs are due together, one SHALL start and the rest SHALL
be reported as waiting. A second mutating run is refused by the workspace
lease, and presenting that refusal as an error would describe a fault
that is not one.

A schedule naming a change that no longer exists SHALL be dropped, and
the drop SHALL be reported. A change that is neither active nor archived
was deleted, and an entry for it would wait forever.

#### Scenario: A run scheduled while the application stays open

- **WHEN** a run is scheduled for a time and the application is open then
- **THEN** it starts at that time

#### Scenario: A run whose time passed while nothing was open

- **WHEN** the application is opened after a scheduled time has passed
- **THEN** the run starts and the surface says how late it is

#### Scenario: A time in the past

- **WHEN** a time earlier than now is entered
- **THEN** it is refused where it was entered

#### Scenario: Two runs due at once

- **WHEN** two scheduled runs come due together
- **THEN** one starts and the other is reported as still waiting

#### Scenario: A schedule for a change that was deleted

- **WHEN** a scheduled run names a change that is neither active nor
  archived
- **THEN** the entry is dropped and the drop is reported
