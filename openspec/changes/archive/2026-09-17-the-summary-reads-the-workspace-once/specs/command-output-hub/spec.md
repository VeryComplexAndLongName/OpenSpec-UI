## ADDED Requirements

### Requirement: The OpenSpec view summary reads the workspace once per request

The server SHALL build the overview's archived-change summaries from the
single workspace reading that request already made, and SHALL NOT read the
workspace again per archived change. The summaries SHALL be the same values
a reading per change would give.

#### Scenario: A workspace with many archived changes

- **WHEN** the overview is requested for a workspace with 250 archived
  changes
- **THEN** the workspace is discovered once for that request
- **AND** each archived change's completed and total task counts and last
  modification time are returned as before

#### Scenario: A summary is built from a reading, not from the disk layout

- **WHEN** archived-change summaries are built from a workspace reading whose
  root no longer exists but whose change directories do
- **THEN** each change's counts come from its own `tasks.md`
