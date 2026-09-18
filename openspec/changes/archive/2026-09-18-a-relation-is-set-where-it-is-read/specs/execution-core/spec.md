## ADDED Requirements

### Requirement: A stated relation can be changed through core

Core SHALL be able to add and remove a relation a change states about
another, writing the change's own metadata file, so that a host offers the
edit without knowing the file's shape.

The rewrite SHALL keep every part of the file the edit does not concern:
other keys, comments, key order, the file's line endings and its trailing
newline. A metadata file is written by hand as well, and an edit that
reorders or strips it would be a worse defect than the one being fixed.

The edit SHALL be refused, with the reason and the ids involved, where it
names a change the workspace does not have, where a change would relate to
itself, where the relations would form a cycle, or where the change being
edited is archived. The refusal SHALL be a value the caller reads, not an
exception it has to parse.

The cycle check SHALL be the one the relation gate uses, run over the
graph as it would be after the edit. Two answers to whether a set of
relations forms a cycle is the drift this requirement exists to prevent.

#### Scenario: Adding a relation

- **WHEN** core is asked to add a relation from one change to another that
  the workspace has
- **THEN** the change's metadata file states it, and every other line of
  that file is unchanged

#### Scenario: Removing the last value

- **WHEN** the relation removed was the only one that key stated
- **THEN** the key is removed rather than left stating nothing, which the
  parser reports as an error

#### Scenario: An id no change has

- **WHEN** the edit names a change that is neither active nor archived
- **THEN** it is refused, naming the id, and no file is written

#### Scenario: An edit that closes a cycle

- **WHEN** the relations after the edit would form a cycle
- **THEN** it is refused, naming the changes in the cycle, and no file is
  written

#### Scenario: An archived change

- **WHEN** the change being edited is archived
- **THEN** it is refused: archiving is what makes the record final
