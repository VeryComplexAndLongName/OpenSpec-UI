## ADDED Requirements

### Requirement: A suggestion is shown by one component in both hosts

Where a host shows what the repository suggests, it SHALL render it with
the shared component, from the payload the shared client already
fetches, and SHALL NOT compute a suggestion of its own.

A suggestion computed in a host exists in that host only, cannot be
printed by the command line, and cannot be tested without starting that
host — the same reasoning ADR 0001 gives for keeping behaviour in the
core package.

A suggestion SHALL be shown with its reason and its commands as text a
person can select and copy. It SHALL NOT be shown with a control that
runs those commands: a suggestion that acts is no longer a suggestion,
and nothing in this capability writes to a repository.

Where there is nothing to suggest, nothing SHALL be shown — not an empty
region with a heading.

#### Scenario: A host renders suggestions

- **WHEN** the payload carries suggestions
- **THEN** each is shown with its subject, its reason and its commands
  as selectable text, by the shared component in either host

#### Scenario: Nothing to suggest

- **WHEN** the payload carries no suggestion
- **THEN** the host shows nothing in their place
