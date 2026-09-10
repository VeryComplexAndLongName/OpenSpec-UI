## ADDED Requirements

### Requirement: A name from outside the process is checked before it is used

Where a request names a change, the name SHALL be validated against the
change-name rule before it is joined into any path, and the validation
SHALL live in core beside the path it protects.

A host that checks the name and a host that does not are two hosts with
different security models over one function. The function is where the
rule is kept.

Where a request carries a record to be stored, the record SHALL be
validated on the way in by the same rule that will be applied when it is
read back. A record that is accepted and then discarded on read answers
one thing and does another.

Where a request asks for two operations that cannot both be what the
sender meant, it SHALL be refused rather than have one applied.

#### Scenario: A change name that leaves the workspace

- **WHEN** a request names a change with a path component that is not a
  change name
- **THEN** it is refused before any path is built, and the refusal names
  the rule

#### Scenario: A record that would not be read back

- **WHEN** a request stores a record that the reader's own validation
  would discard
- **THEN** it is refused, naming the field

#### Scenario: Two operations in one request

- **WHEN** a request carries both an addition and a removal
- **THEN** it is refused, and nothing is applied
