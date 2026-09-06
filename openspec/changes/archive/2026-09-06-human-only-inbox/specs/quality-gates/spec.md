## ADDED Requirements

### Requirement: A named successor is a real one

Where a change's tasks state that a successor change was created, a check
SHALL verify that a change exists which states it follows that change.

Naming a successor in prose and creating none is how work that was
honestly reported as unresolved loses its owner. The stated relation is
already verified; the prose that promises one is not, and it is the form
the failure has actually taken here.

The check SHALL state what wording it looked for, so that a change
phrasing it differently is a known gap rather than a silent pass.

#### Scenario: A successor is named and exists

- **WHEN** a change's tasks name a successor, and a change states that it
  follows that change
- **THEN** the check passes

#### Scenario: A successor is named and does not exist

- **WHEN** a change's tasks name a successor and no change states that it
  follows that change
- **THEN** the check fails, naming the change and the successor it named

### Requirement: A spec delta is checked against the spec it modifies

A change that states it modifies a requirement SHALL be checked, before
it is archived, against the specification it modifies.

A modified block whose requirement header no longer exists, or which
omits a scenario the current specification carries, SHALL fail. Archiving
already refuses both, but it refuses at the end — after the work is
finished and reviewed — and the drift is not the author's doing: it comes
from another change landing in between.

#### Scenario: The requirement was renamed since the change was written

- **WHEN** a modified block names a requirement header the specification
  no longer carries
- **THEN** the check fails, naming the header and the specification

#### Scenario: A scenario was added since the change was written

- **WHEN** the specification carries a scenario the modified block omits
- **THEN** the check fails, naming the scenario that would be dropped

#### Scenario: The delta still matches

- **WHEN** a modified block matches the specification it modifies
- **THEN** the check passes, and archiving is not the first place this
  was known
