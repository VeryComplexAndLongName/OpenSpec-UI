# release-quality Specification

## Purpose
TBD - created by archiving change release-quality-gates. Update Purpose after archive.
## Requirements
### Requirement: Pull requests receive automated quality checks

The repository SHALL run typechecking, linting, unit and contract tests, and
delivery builds with the pinned Node.js and npm versions for every pull
request and main-branch update.

#### Scenario: A pull request introduces a type error

- **WHEN** CI evaluates the pull request
- **THEN** the quality job fails before the change can be treated as releasable

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

### Requirement: Dependency changes are continuously reviewed

The repository SHALL review dependency changes in pull requests and SHALL
schedule updates for npm and GitHub Actions dependencies.

#### Scenario: A dependency pull request is opened

- **WHEN** dependency metadata changes
- **THEN** the workflow reports dependency review results

