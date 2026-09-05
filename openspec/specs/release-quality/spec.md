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

### Requirement: A check's budget accommodates its dominant step's variance

Where a check's duration is dominated by a step whose cost varies between
runs, its time budget SHALL be set from the observed range of that step
rather than from a typical run, so that the check reports on what it
verifies rather than on how a runner performed.

Two checks that share a dominant step SHALL NOT be given budgets that
disagree about how long that step takes.

A budget SHALL be recorded with the measurement it was chosen from.

#### Scenario: The dominant step runs slowly

- **WHEN** a check's dominant step takes toward the upper end of its
  observed range
- **THEN** the check still completes and reports its own result

#### Scenario: What the check verifies is violated

- **WHEN** the condition a check exists to catch is actually violated
- **THEN** it fails on that, and its report names it

#### Scenario: Two checks share a step

- **WHEN** two checks both begin with the same installation step
- **THEN** neither is given less time for it than the other

