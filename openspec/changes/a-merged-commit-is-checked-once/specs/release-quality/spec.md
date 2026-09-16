## MODIFIED Requirements

### Requirement: Pull requests receive automated quality checks

The repository SHALL run typechecking, linting, unit and contract tests, and
delivery builds with the pinned Node.js and npm versions for every pull
request, except the version pull request, which receives the check described
in "The version pull request is checked for what it changes".

A push to `main` SHALL NOT run these checks again. What lands on `main` is
what a pull request's checks ran on, as "Main receives only what its pull
request checked" requires.

#### Scenario: A pull request introduces a type error

- **WHEN** CI evaluates the pull request
- **THEN** the quality job fails before the change can be treated as releasable

#### Scenario: A pull request merges

- **WHEN** a pull request whose checks passed is merged to `main`
- **THEN** the run for that push performs the release path and does not run
  the quality checks, the merge gate, the extension suite or the browser
  suite again

### Requirement: The extension delivery artifact is exercised and released

The repository SHALL run the extension integration suite in a real
Extension Host on every pull request other than the version pull request,
and SHALL package a VSIX artifact there. On every push to `main` where
`openspec-ui-vscode`'s version has no matching git tag yet, the repository
SHALL package the VSIX, create an annotated tag
(`openspec-ui-vscode@<version>`) and publish a GitHub Release for that tag
with the versioned VSIX attached as a downloadable asset, without running the
integration suite again.

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

## ADDED Requirements

### Requirement: The version pull request is checked for what it changes

The version pull request SHALL be checked by a clean install from its
lockfile, the build, and the extension's package at the version it proposes.
It SHALL NOT run the extension integration suite or the browser suite, whose
subject its diff does not change.

#### Scenario: The version pull request's lockfile disagrees with its manifests

- **WHEN** the version pull request changes a version and the lockfile does
  not describe it
- **THEN** its check fails at the install

#### Scenario: The version pull request is updated

- **WHEN** the bot updates the version pull request after a merge
- **THEN** its check runs, and the integration and browser suites report as
  skipped

### Requirement: Main receives only what its pull request checked

A pull request SHALL NOT merge to `main` unless its required checks passed on
a branch that is up to date with `main`. Where `main` has moved since the
checks ran, the pull request SHALL be updated and checked again before it can
merge.

A check skipped by its own condition SHALL satisfy the requirement, so that
the version pull request is not held by the suites it does not run and an
ordinary pull request is not held by the version pull request's check.

#### Scenario: Main moves under an open pull request

- **WHEN** another pull request merges while this one's checks have passed
- **THEN** this one cannot merge until it is updated and its checks pass
  again

#### Scenario: The version pull request

- **WHEN** the version pull request's own check passes and the suites it
  does not run are skipped
- **THEN** it can merge
