## ADDED Requirements

### Requirement: Immutable publication contract
Quality SHALL publish only stable versioned release assets with their SHA-256, channel and release commit in publications.json. Registry workers SHALL use these exact bytes without rebuilding.

#### Scenario: An existing version is released again
- **WHEN** a main change carries an existing version tag
- **THEN** its original release asset and commit are reused and no replacement artifact is built

#### Scenario: Artifact bytes disagree
- **WHEN** a downloaded asset differs from the approved SHA-256
- **THEN** no registry write occurs and the failure is reported

### Requirement: Automatic OIDC workers
Publish SHALL automatically pull eligible Homepage jobs after successful main Quality and on a recovery schedule. Both channels SHALL use narrowly scoped GitHub OIDC identities without long-lived registry tokens.

#### Scenario: A version is already published
- **WHEN** a previous write succeeded but its result was lost
- **THEN** the worker verifies the remote version before another write and reports its confirmation

#### Scenario: A non-main event runs
- **WHEN** a dispatch names another branch or Quality completed for a pull request
- **THEN** no privileged publishing job executes

#### Scenario: A worker fails
- **WHEN** download, publication or confirmation fails
- **THEN** the run reports failure and Homepage retains a bounded retry or a visible exhausted state
