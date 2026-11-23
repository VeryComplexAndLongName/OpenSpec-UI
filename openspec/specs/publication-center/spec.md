# publication-center Specification

## Purpose
Immutable checked release artifacts and automatic, authenticated registry workers coordinated by Homepage.

## Requirements

### Requirement: Immutable publication contract
Quality SHALL publish only stable versioned release assets with their SHA-256, channel and release commit in publications.json. Registry workers SHALL use these exact bytes without rebuilding.

#### Scenario: An existing version is released again
- **WHEN** a main change carries an existing version tag
- **THEN** its original release asset and commit are reused and no replacement artifact is built

#### Scenario: Artifact bytes disagree
- **WHEN** a downloaded asset differs from the approved SHA-256
- **THEN** no registry write occurs and the failure is reported

### Requirement: Automatic OIDC workers
Homepage SHALL remain the automatic publication authority. An npm worker SHALL
use CircleCI Free hosted V2 OIDC restricted to the exact approved organization,
project, pipeline, context and main config/checkout refs without SSH execution.
An isolated Marketplace worker SHALL use the existing Entra certificate and
Contributor identity, outside Flask and PR jobs. Workers SHALL verify signed
Gitea receipts, exact artifact hashes and product identities before a write.
Scheduled recovery SHALL not depend on GitHub Actions or notification delivery.

#### Scenario: A version is already published
- **WHEN** a previous write succeeded but its result was lost
- **THEN** the worker independently confirms the existing version before another write
- **AND** the existing Homepage lease/finish contract retains the result

#### Scenario: A non-main identity calls the queue
- **WHEN** source refs, audience, context, signature or lease identity differs
- **THEN** no privileged publication is performed and the request is rejected

#### Scenario: A non-main event runs
- **WHEN** a dispatch names another branch or Quality completed for a pull request
- **THEN** no privileged publishing job executes

#### Scenario: A worker fails
- **WHEN** download, publication or independent confirmation fails
- **THEN** the run fails and Homepage retains its finite retry or exhausted state

#### Scenario: Approved bytes have changed
- **WHEN** the receipt, artifact hash or inner product identity does not match
- **THEN** the worker refuses the registry write without rebuilding the package
