## ADDED Requirements

### Requirement: A change is archived only when nothing is owed

Archiving a change through this product SHALL refuse where the change's
task list has an item open, or an item marked as needing a person or
naming an agent that is closed with nothing written under it. The
refusal SHALL name each such item by its number and its text, and SHALL
leave the change where it is.

What an item still owes SHALL be decided in one place that every reader
uses: the merge gate, the archive, and anything else that asks.

#### Scenario: An item still open

- **WHEN** a change with an unticked item is archived through this
  product
- **THEN** the archive refuses, names the item, and nothing moves

#### Scenario: A human-only item ticked with nothing written

- **WHEN** a change whose human-only item is closed with no record is
  archived
- **THEN** the archive refuses and names that item

#### Scenario: Everything closed

- **WHEN** every item is closed, and every human-only or delegated one
  carries a record
- **THEN** the archive proceeds as before
