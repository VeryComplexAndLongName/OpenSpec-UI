## MODIFIED Requirements

### Requirement: The extension delivery artifact is exercised and released

The repository SHALL run the extension integration suite in a real
Extension Host and SHALL package a VSIX artifact after successful
validation. On every push to `main` where `openspec-ui-vscode`'s version
has no matching git tag yet, the repository SHALL additionally create an
annotated tag (`openspec-ui-vscode@<version>`) and publish a GitHub
Release for that tag with the versioned VSIX attached as a downloadable
asset.

#### Scenario: Extension packaging succeeds

- **WHEN** the delivery job completes
- **THEN** the workflow retains the generated VSIX for inspection

#### Scenario: A new extension version merges to main

- **WHEN** a push to `main` includes a `packages/extension/package.json`
  version not yet tagged
- **THEN** CI creates the `openspec-ui-vscode@<version>` tag, pushes it,
  and publishes a GitHub Release with the versioned VSIX attached

#### Scenario: Main is pushed without a version bump

- **WHEN** a push to `main` does not change `openspec-ui-vscode`'s
  version
- **THEN** the release job detects the existing tag and completes as a
  no-op, without creating a duplicate tag or release
