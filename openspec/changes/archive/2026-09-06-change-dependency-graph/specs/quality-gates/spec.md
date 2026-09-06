## ADDED Requirements

### Requirement: A stated relation between changes is verified, not trusted

Where a change states that it follows from, or supersedes, another
change, that statement SHALL be recorded in a form a check can read, and
SHALL be verified as part of the lint gate.

A stated relation naming a change that does not exist SHALL fail the
gate, whether the named change is expected to be active or archived. A
successor that was named but never created is the failure this guards
against, and it SHALL not be discoverable only by someone later reading
prose.

A set of stated relations that forms a cycle SHALL fail the gate, since
no ordering of the changes can satisfy it.

The verification SHALL name the change and the unresolved id, so the
author can act on it without opening the metadata.

#### Scenario: A named successor does not exist

- **WHEN** a change states that it follows or supersedes a change id that
  matches no active or archived change
- **THEN** the lint gate fails, naming both the change and the id

#### Scenario: The named change is archived

- **WHEN** a stated relation names a change that has since been archived
- **THEN** it resolves, because archiving is not deletion, and the gate
  passes

#### Scenario: The relations form a cycle

- **WHEN** stated relations form a cycle among two or more changes
- **THEN** the lint gate fails and names the changes in it

#### Scenario: A change states no relation

- **WHEN** a change states neither relation
- **THEN** the gate passes: the relation is optional, and an absent edge
  is not an error
