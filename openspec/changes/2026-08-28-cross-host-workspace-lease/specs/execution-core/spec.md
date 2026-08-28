## ADDED Requirements

### Requirement: Command kind validation has one source of truth

The system SHALL define the set of valid command kinds in exactly one
place in `packages/core`. Any transport-boundary shape check performed
by a delivery adapter (for example, the server's incoming-message
validation) SHALL import that same set rather than declaring its own
list of command kind literals.

#### Scenario: Core adds a new command kind

- **WHEN** a new command kind is added to the core protocol
- **THEN** every adapter's shape-check-based validation recognizes it as
  valid without a matching hand-edit to a separately maintained literal
  list
