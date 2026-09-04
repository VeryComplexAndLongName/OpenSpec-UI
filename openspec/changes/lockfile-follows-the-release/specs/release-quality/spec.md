## ADDED Requirements

### Requirement: A release updates the lockfile it invalidates

Where a release changes a workspace's published version, the system SHALL
update the dependency lockfile in the same change, so that the lockfile
continues to describe the packages it accompanies.

The system SHALL NOT rely on an unrelated change to repair that drift
later.

Updating the lockfile during a release SHALL NOT change which dependency
versions are resolved.

#### Scenario: A release bumps a version

- **WHEN** a release changes a workspace's version
- **THEN** the lockfile records that version in the same change

#### Scenario: No release is pending

- **WHEN** no version changes
- **THEN** the lockfile is left alone

#### Scenario: A release would alter dependency resolution

- **WHEN** updating the lockfile for a release would change a resolved
  dependency version
- **THEN** that is a defect to investigate, not an expected part of
  releasing
