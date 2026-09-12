## ADDED Requirements

### Requirement: A release is explained in the terms of the person using it

What a release changed SHALL be written for the person who uses this
tool, not only for the person who builds it.

A package's `CHANGELOG.md` states what changed in that package. It does
not state what a capability is for, what it replaces, or how it is
reached, and a reader who does not already know a feature exists cannot
learn it from a changeset entry. Reference documentation (`HARNESS.md`,
`LIMITS.md`) is organised by configuration key, which has the same
property: it answers questions about a capability already known to the
reader.

Such a document SHALL state the version range it covers and the package
versions it was written against, and SHALL cite, for each capability it
describes, the archived change that introduced it — so a claim can be
checked against the repository rather than believed.

It SHALL NOT describe a capability that is not archived at the time it
is written.

#### Scenario: A release adds a capability a user must be told about

- **WHEN** a release adds a capability a person using the tool would
  have to be told about to use
- **THEN** it is described in the user's terms, with the command or
  screen it is reached from, and with the archived change it came from
  named

#### Scenario: A capability is proposed but not archived

- **WHEN** a capability has been proposed and not archived
- **THEN** it is absent from the document, whatever state its
  implementation is in
