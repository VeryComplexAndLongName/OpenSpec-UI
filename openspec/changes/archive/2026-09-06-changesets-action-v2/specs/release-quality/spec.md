## ADDED Requirements

### Requirement: The version pull request is maintained by a supported action major

The repository SHALL maintain its pending-version pull request using a
currently supported major version of its release automation, and SHALL
supply that automation's credentials through the input it reads them
from rather than through configuration it ignores.

Where a step's credentials are supplied somewhere the step does not read,
that configuration SHALL be removed rather than left in place, so that it
cannot be mistaken for something load-bearing.

#### Scenario: Changesets are pending on the default branch

- **WHEN** the default branch carries pending changesets
- **THEN** the version pull request is created or updated

#### Scenario: No changesets are pending

- **WHEN** the default branch carries none
- **THEN** no version pull request is created

#### Scenario: Credentials in configuration the step ignores

- **WHEN** a step's credentials are set where that step does not read
  them
- **THEN** that configuration is removed rather than retained alongside
  the one that works
