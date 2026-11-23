## REMOVED Requirements

### Requirement: Publishing to the Marketplace is asked for, never inferred
**Reason**: The owner now requires automatic publication coordinated by Homepage (ADR 0058).
**Migration**: Checked immutable releases enter the automatic Homepage queue and use OIDC workers.

### Requirement: Publishing to npm is asked for, never inferred
**Reason**: The owner now requires automatic publication coordinated by Homepage (ADR 0058).
**Migration**: Preserve publish.yml and the npm environment, and publish approved release tarballs through native OIDC.

## MODIFIED Requirements

### Requirement: The CLI link is additive and delivered through the release path
`links.npm` SHALL remain optional and releases.json SHALL retain schema version 1. The CLI version bump SHALL trigger fingerprint-based release manifest publication. Quality SHALL prepare an immutable CLI tarball in a versioned GitHub Release and publish its checksum in the separate publications.json contract. Registry publication SHALL be automatic through the Homepage queue rather than part of artifact preparation.

#### Scenario: An older consumer receives the npm link
- **WHEN** a schema-1 consumer that ignores unknown fields reads the manifest
- **THEN** it accepts the manifest without a schema-version upgrade

#### Scenario: The CLI version bump lands
- **WHEN** a stable CLI version bump lands on main
- **THEN** the release path prepares its immutable tarball and publishes the manifests
- **AND** an automatic OIDC worker publishes or reconciles the version through Homepage
