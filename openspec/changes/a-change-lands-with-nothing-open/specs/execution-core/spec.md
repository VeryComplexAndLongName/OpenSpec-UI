## ADDED Requirements

### Requirement: A closed task item says how it ended

A task item that is closed SHALL carry one of three endings, read from
its own line and the lines continuing it:

- **done** - it was carried out;
- **waived** - a person looked and decided not to carry it out;
- **deferred** - it is a judgement about the shipped thing, and it has
  moved to the collection of what waits on a person.

An open item SHALL carry no ending. The ending SHALL be absent rather
than a default where a closed item declares none, which is how every
item written before this existed reads: done.

A closed item marked as needing a person, or naming an agent, SHALL be
reported as unrecorded where nothing is written under it. For such an
item "done" is a claim about something that happened outside the
repository, and what was run and what was seen is the only thing that
makes it checkable afterwards.

#### Scenario: An item a person waived

- **WHEN** a closed item's text carries a waiver naming who decided and
  why
- **THEN** its ending reads as waived

#### Scenario: An item deferred until the work ships

- **WHEN** a closed item's text says it has been deferred
- **THEN** its ending reads as deferred, and the change it belongs to is
  not held open by it

#### Scenario: An ordinary tick

- **WHEN** a closed item declares no ending
- **THEN** its ending reads as done

#### Scenario: A human-only item ticked with nothing written

- **WHEN** an item marked as needing a person is closed and nothing is
  written under it
- **THEN** it is reported as unrecorded
