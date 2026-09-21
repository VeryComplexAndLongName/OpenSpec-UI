## ADDED Requirements

### Requirement: The Change Graph reads once, and only for what it reads

The Change Graph view SHALL read the graph once per drawing, sharing that
reading between the root and every expanded row, and between calls that
arrive together.

It SHALL be refreshed only by an event on a path the graph reads: a
change's `.openspec.yaml`, or a change directory - active or archived -
appearing or going. Which paths those are SHALL be said by
`packages/core`, beside the function that reads them, so that the two
cannot drift.

The graph reads two directory listings and one small file per change.
Measured on 2026-09-21 over 293 archived changes, one reading is 159 ms;
what held a processor at 100% was that reading repeated once per open row
on every tick a run wrote to a task list.

#### Scenario: A run ticks a task

- **WHEN** a run ticks an item in a change's `tasks.md` while the Change
  Graph is open
- **THEN** the graph is not read again

#### Scenario: A relation changes

- **WHEN** a change's `.openspec.yaml` is written
- **THEN** the graph is read again, once, however many rows are open

#### Scenario: A change is archived

- **WHEN** a change directory moves into the archive
- **THEN** the graph is read again
