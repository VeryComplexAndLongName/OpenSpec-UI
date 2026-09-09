## ADDED Requirements

### Requirement: A missing design does not make a proposed change unproposed

Where a chain resumes, a change SHALL be treated as proposed when its
proposal and its task list exist, whether or not it has a design.

A change may deliberately carry no design, and the validator accepts one
that does not. The status command reports such an artifact as ready to be
produced rather than as done, and reading that as an unfinished proposal
sends a chain back to its proposing stage on work that is already
written.

An artifact reported as ready SHALL NOT be read as complete. Ready is
what the command says about an artifact it could produce, including one
nobody has started.

#### Scenario: Resuming a change that has no design

- **WHEN** a chain resumes on a change whose proposal and tasks exist and
  whose design does not
- **THEN** it starts from the implementation, not from proposing

#### Scenario: Resuming a change whose proposal is not written

- **WHEN** a chain resumes on a change with no proposal
- **THEN** it starts at proposing
