## ADDED Requirements

### Requirement: A task list read during a run is read once it is settled

Where a run reads its change's `tasks.md` to decide where a stop may end,
`packages/core` SHALL read the list again until two readings a moment
apart agree. A list with no task item SHALL be read as unreadable. A
named task SHALL be reported missing only where a settled list does not
have it.

#### Scenario: The list is rewritten while it is read

- **WHEN** `tasks.md` is truncated and written again while a run told to
  stop after 2.2 reads it, and 2.2 is ticked in what is written
- **THEN** the run reads 2.2 as ticked, never as missing

#### Scenario: An empty list

- **WHEN** `tasks.md` holds no task item at the moment it is read
- **THEN** the reading is unreadable, and neither ends nor moves the run
