## MODIFIED Requirements

### Requirement: Products not offered to the public are marked, not hidden

The release manifest SHALL retain all five stable product entries and their
version sources. It SHALL mark `vscode-extension`, `standalone-app` and
`ci-cli` public, and SHALL mark `core` and `shared-ui` non-public, so consumers
can choose what to present without losing internal release records.

#### Scenario: Core and Shared UI remain internal

- **WHEN** `write manifest` builds the repository's manifest
- **THEN** all five product ids and their versions are present
- **AND** Core and Shared UI are marked not public
- **AND** only Extension, Standalone App and CLI are public

#### Scenario: An internal product

- **WHEN** Core or Shared UI is not offered to the public
- **THEN** the manifest includes the product, marked as not public

## ADDED Requirements

### Requirement: A product visibility change triggers manifest publication

The deterministic manifest fingerprint SHALL include each product's public
state as well as its stable id and version. Generation time and commit SHALL
NOT affect that fingerprint.

#### Scenario: Core visibility changes without a package release

- **WHEN** a product's public state changes while all product versions,
  generation time and commit remain unchanged
- **THEN** the manifest fingerprint changes
- **AND** CI publishes the updated manifest through the existing release path