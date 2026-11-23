## ADDED Requirements

### Requirement: Development and public distribution have explicit authorities

Gitea SHALL own reviewed main and all quality/build CI. Existing GitHub
repositories SHALL remain mirrors and release asset hosts with their existing
visibility and public URLs preserved. Homepage
SHALL manage publication eligibility and outcomes. Registry executors SHALL
consume exact checked artifacts without rebuilding. Public package identities
and source/documentation/feedback destinations SHALL remain unchanged.

#### Scenario: A contributor follows an existing public source link

- **WHEN** the contributor follows an existing README, package or feedback link
- **THEN** the GitHub destination remains available
- **AND** contribution instructions identify Gitea as development authority

### Requirement: Preservation precedes provider cutover

The migration SHALL preserve source refs, outstanding PR heads, published
assets and metadata before cutover. Existing version assets SHALL NOT be
replaced or rebuilt. This migration SHALL NOT delete either GitHub repository
or schedule its retirement.

#### Scenario: A historical file cannot be verified

- **WHEN** its source hash or destination bytes cannot be verified
- **THEN** the preservation gap is reported and complete cutover is not claimed

#### Scenario: Earlier planning proposed GitHub deletion

- **WHEN** the revised migration is applied
- **THEN** GitHub remains the public mirror and release host without a deletion date
