## MODIFIED Requirements

### Requirement: A run can be asked for at a time, and reports what became of it

A run SHALL be requestable for a time rather than for now, from the same
entry that starts one immediately.

Where the application is open at that time, the run SHALL start. Where it
is not, the run SHALL start when the application is next opened, and the
surface SHALL say how late it is. Opening the application SHALL be
enough: a schedule that waits for a further action after the open is one
that did not start at the next open.

A schedule that does not happen SHALL NOT be indistinguishable from one
that does. The entry SHALL say, before it is made, that it depends on the
application being open, and SHALL say afterwards when a run started later
than it was asked for.

The path chosen when the run was asked for SHALL be the path it takes
when it starts. Where that path is no longer offered for the change, the
surface SHALL ask for a choice and say why.

An entry SHALL be consumed only once the run it names has been opened.
Where opening fails, the entry SHALL remain and the failure SHALL be
reported as a failure to open the run, not as a failure to read the
schedule.

A time already past SHALL be refused where it is entered rather than
accepted and fired at once.

Where several runs are due together, one SHALL start and the rest SHALL
be reported as waiting. A second mutating run is refused by the workspace
lease, and presenting that refusal as an error would describe a fault
that is not one.

A schedule naming a change that no longer exists SHALL be dropped, and
the drop SHALL be reported. A schedule naming a change that has since
been archived SHALL be dropped as archived, distinctly: its work is done,
and a run against it is not one anybody asked for.

What to do with a schedule SHALL be decided in one place, in core; a host
SHALL perform the effects it is handed and decide nothing about the
schedule itself.

A run dialog that opens without the person's action SHALL be announced,
and what the schedule did SHALL be readable from any part of the surface.

#### Scenario: A run scheduled while the application stays open

- **WHEN** a run is scheduled for a time and the application is open then
- **THEN** it starts at that time, on the path that was chosen

#### Scenario: A run whose time passed while nothing was open

- **WHEN** the application is opened after a scheduled time has passed,
  and nothing else is done
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

#### Scenario: A schedule for a change that was archived

- **WHEN** a scheduled run names a change that was archived after it was
  scheduled
- **THEN** the entry is dropped, the report says it was archived, and a
  run due behind it starts on the same reading

#### Scenario: The run cannot be opened

- **WHEN** a due run's configuration cannot be resolved
- **THEN** the entry remains in the schedule and the surface says the run
  could not be opened, and why

#### Scenario: A dialog that opened by itself

- **WHEN** a scheduled run opens the run dialog
- **THEN** the dialog is announced and takes focus, and the schedule's
  message is readable from any tab
