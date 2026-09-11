## ADDED Requirements

### Requirement: Every active change reports a state with its reason

The CLI SHALL report, for each active change, whether it is running,
ready to start, or blocked.

A state SHALL carry the fact that produced it. `blocked` SHALL name what
blocks it; `running` SHALL name where it is running. A state a reader
has to investigate is a state that has not been reported.

#### Scenario: A change waiting on another

- **WHEN** a change declares a blocker that is still an active change
- **THEN** it is reported as blocked, naming that change

#### Scenario: A change under way

- **WHEN** a change's working directory currently holds the workspace
- **THEN** it is reported as running, naming that directory

#### Scenario: A change with nothing in its way

- **WHEN** a change declares no unmet blocker and nothing is running it
- **THEN** it is reported as ready

### Requirement: A ready change says what it can start alongside

For each ready change, the report SHALL name the other ready changes it
can be started alongside, and those it cannot together with what they
would collide over.

The answer SHALL be given per pair rather than as a single group of
changes that may run together. Where three changes collide in a chain,
no one grouping is correct, and presenting one hides from the reader
that a choice existed.

#### Scenario: Two changes that do not overlap

- **WHEN** two ready changes share no capability, no declared relation
  and no touched file
- **THEN** each is reported as able to start alongside the other

#### Scenario: Two changes that would meet in the same spec

- **WHEN** two ready changes each deliver a delta for the same
  capability
- **THEN** they are reported as colliding, naming that capability

#### Scenario: Two branches that have edited the same file

- **WHEN** two changes have working directories whose branches have both
  changed a file
- **THEN** they are reported as colliding, naming that file

### Requirement: Collision is derived from what already exists

The report SHALL determine collisions from the relations a change
already declares, from the capabilities its spec delta already names,
and from what its branch already contains.

It SHALL NOT require a change to declare the files or paths it intends
to touch. Such a declaration is written before the work by whoever knows
least about it, is maintained by hand, and once it has drifted is worse
than no declaration at all, because it is believed.

#### Scenario: A change that declares nothing beyond its own specs

- **WHEN** a change carries no extra metadata about what it will touch
- **THEN** it is still placed correctly against the others

### Requirement: Running in parallel requires a working directory each

A change without a working directory of its own SHALL be reported as not
startable in parallel, whatever its relations allow.

One working directory permits one mutating run, so two changes sharing
one are sequential regardless of whether they would collide. The report
SHALL say what would make the change startable alongside another.

#### Scenario: A ready change with nowhere of its own to run

- **WHEN** a ready change has no working directory
- **THEN** the report says it can be started on its own, and what to do
  to run it alongside another
