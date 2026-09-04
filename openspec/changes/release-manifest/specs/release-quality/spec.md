## ADDED Requirements

### Requirement: What the repository ships is published as a manifest

The repository SHALL publish a machine-readable manifest describing each
product it ships — its identity, its current version, and where to obtain
it — so that a consumer needs no knowledge of the repository's internal
layout.

The manifest SHALL be retrievable without authentication and without
consuming a rate-limited interface.

The manifest SHALL declare the version of its own format, so that a
consumer meeting a format it does not understand can refuse the document
rather than misread it.

#### Scenario: A release lands

- **WHEN** a product's released version changes on the default branch
- **THEN** the published manifest states that version for that product

#### Scenario: A consumer fetches the manifest

- **WHEN** a consumer retrieves the manifest
- **THEN** no credential is required and no rate-limited interface is used

#### Scenario: The format changes incompatibly

- **WHEN** the manifest is published in a format version a consumer does
  not support
- **THEN** the consumer can identify that from the document itself

### Requirement: A product's identity is stable across repository changes

Each product in the manifest SHALL carry an identifier that is stable
independently of how the repository is organised, and SHALL NOT derive
that identifier from a package name or a directory path.

Identifiers SHALL be unique within the manifest.

Where the repository is reorganised — a package renamed, moved, or split
— the manifest SHALL continue to describe the same products under the
same identifiers.

#### Scenario: A package is renamed

- **WHEN** a package's name or directory changes
- **THEN** its product's identifier in the manifest is unchanged

#### Scenario: Two products would share an identifier

- **WHEN** the manifest would carry the same identifier twice
- **THEN** producing it fails rather than publishing an ambiguous
  document

### Requirement: The manifest states only what the repository knows

Every figure in the manifest SHALL come from the repository's own
records. The system SHALL NOT estimate, infer, or invent a version, a
release note, or a download location.

Where a product has no downloadable artifact, or its release notes cannot
be read, the manifest SHALL omit that information rather than supply a
placeholder.

A location the manifest offers for download SHALL be one that exists at
the time of publication, rather than one constructed from a naming
convention.

#### Scenario: Release notes cannot be parsed

- **WHEN** a product's changelog cannot be read in the expected form
- **THEN** the manifest carries no release notes for that product, and
  the rest of the manifest is still published

#### Scenario: A product ships no artifact

- **WHEN** a product has no downloadable file
- **THEN** the manifest lists none for it

#### Scenario: A product ships an artifact

- **WHEN** a product's release publishes a downloadable file
- **THEN** the manifest points at that published file

### Requirement: Products not offered to the public are marked, not hidden

The manifest SHALL carry every product the repository ships, and SHALL
mark which of them are offered to the public, so that a consumer decides
what to present rather than being given a pre-filtered list.

#### Scenario: An internal product

- **WHEN** a product is not offered to the public
- **THEN** the manifest includes it, marked as not public
