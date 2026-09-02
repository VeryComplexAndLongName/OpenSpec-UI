## MODIFIED Requirements

### Requirement: A stage that invokes no agent offers no agent setting

A stage the system runs without invoking a CLI agent SHALL NOT accept an
agent entry in a harness configuration, and neither settings surface
SHALL offer an agent, reasoning effort or spending cap control for it.

This SHALL hold for every such stage, not for a subset of them. Where the
system runs a stage directly rather than through an agent, that fact
SHALL determine whether the stage can carry an entry.

A configuration that set an entry for such a stage before this
restriction SHALL be read, that entry dropped with a report naming the
stage, and the rest honoured. Such a file SHALL NOT be rejected.

Such a stage SHALL remain listed in both surfaces, since it runs, and
hiding it would misrepresent the sequence.

#### Scenario: A mechanical stage in the settings surface

- **WHEN** a stage runs without invoking an agent
- **THEN** it appears in the stage list with no agent, effort or spending
  cap control

#### Scenario: A configuration naming an agent for such a stage

- **WHEN** a configuration sets an agent entry for a stage that invokes
  no agent
- **THEN** the file loads, the entry is dropped, and the report names
  that stage

#### Scenario: Several such stages in one configuration

- **WHEN** a configuration sets entries for more than one such stage
- **THEN** every one of them is dropped, and each is named
