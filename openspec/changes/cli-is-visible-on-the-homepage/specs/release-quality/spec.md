# Release Quality Delta

## ADDED Requirements

### Requirement: The manifest exposes CLI as a public npm product

The manifest SHALL preserve the stable `ci-cli` identity and derive its version
from `packages/cli/package.json`. It SHALL mark CLI public, include a summary,
and include `links.npm` equal to `https://www.npmjs.com/package/@openspec-ui/cli`.
No other product SHALL gain an npm link in this change. All five product entries
SHALL remain present; Shared UI SHALL remain non-public.

#### Scenario: The CLI manifest is generated

- **WHEN** `write manifest` builds a complete manifest
- **THEN** CLI is public with its own package version, summary and npm link
- **AND** all five stable product ids remain present

#### Scenario: Existing products retain their destinations

- **WHEN** the updated manifest is generated
- **THEN** extension, standalone, core and Shared UI have no new npm link
- **AND** existing release artifacts and links remain unchanged

### Requirement: The CLI link is additive and delivered through the release path

`links.npm` SHALL be optional and the manifest SHALL retain schema version 1.
The CLI minor version bump SHALL trigger the existing fingerprint-based manifest
publication and notification path. This change SHALL NOT create a GitHub CLI
release or change separately dispatched npm publishing.

#### Scenario: An older consumer receives the npm link

- **WHEN** a schema-1 consumer that ignores unknown fields reads the new manifest
- **THEN** it accepts the manifest without requiring a schema-version upgrade

#### Scenario: The CLI version bump lands

- **WHEN** the change's CLI version bump lands on main
- **THEN** the version fingerprint changes and the existing release path publishes
  CLI visibility and its npm destination for the homepage to consume
