# release-quality Specification

## Purpose
TBD - created by archiving change release-quality-gates. Update Purpose after archive.
## Requirements
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

### Requirement: Dependency changes are continuously reviewed

The repository SHALL review dependency changes in pull requests and SHALL
schedule updates for npm and GitHub Actions dependencies.

Automatic updates SHALL exclude major-version bumps in every ecosystem
the repository schedules, so that a breaking change reaches the
repository as a deliberate, reviewed change rather than as an unreviewed
automated pull request. Minor and patch updates, including security
fixes, SHALL continue to be raised automatically.

Where an update alters something a pull request cannot exercise — a step
that runs only on the default branch, or only on a tag — its correctness
SHALL NOT be inferred from that pull request passing.

#### Scenario: A dependency pull request is opened

- **WHEN** dependency metadata changes
- **THEN** the workflow reports dependency review results

#### Scenario: A major bump becomes available

- **WHEN** a new major version of a scheduled dependency is published, in
  either ecosystem
- **THEN** no automatic pull request proposes it

#### Scenario: A minor or patch bump becomes available

- **WHEN** a new minor or patch version is published
- **THEN** it is still proposed automatically

#### Scenario: A change to a step that pull requests do not run

- **WHEN** a change alters a step that only executes on the default
  branch
- **THEN** that step's outcome is treated as unverified, whatever the
  pull request's own checks report

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

### Requirement: The version pull request is maintained by a supported action major

The repository SHALL maintain its pending-version pull request using a
currently supported major version of its release automation, and SHALL
supply that automation's credentials through the input it reads them
from rather than through configuration it ignores.

Where a step's credentials are supplied somewhere the step does not read,
that configuration SHALL be removed rather than left in place, so that it
cannot be mistaken for something load-bearing.

#### Scenario: Changesets are pending on the default branch

- **WHEN** the default branch carries pending changesets
- **THEN** the version pull request is created or updated

#### Scenario: No changesets are pending

- **WHEN** the default branch carries none
- **THEN** no version pull request is created

#### Scenario: Credentials in configuration the step ignores

- **WHEN** a step's credentials are set where that step does not read
  them
- **THEN** that configuration is removed rather than retained alongside
  the one that works

### Requirement: The dependency audit is a check of its own

The repository SHALL audit its production dependencies for high-severity
advisories as a check that no other check depends on, so that the result
of the audit cannot decide whether the rest of CI runs.

Where the audit fails, the remaining checks SHALL still run and report
their own results.

#### Scenario: The audit fails

- **WHEN** the dependency audit reports a failure
- **THEN** the other checks still run, and each reports its own result

#### Scenario: Another check fails

- **WHEN** a different check fails
- **THEN** the dependency audit still runs and reports its own result

### Requirement: An audit that could not run is not reported as a finding

Where the audit cannot be carried out — the advisory service is
unreachable, returns an error, or does not answer within a bounded time —
the system SHALL report that it could not be carried out, and SHALL NOT
report it as a failing check.

Where the audit is carried out and finds a high-severity advisory, the
system SHALL fail its check.

An audit that could not be carried out SHALL NOT be presented as an audit
that found nothing.

#### Scenario: The advisory service is unavailable

- **WHEN** the audit cannot reach the advisory service
- **THEN** the check does not fail, and the run says the audit could not
  be carried out

#### Scenario: The advisory service does not answer in time

- **WHEN** the audit exceeds its bounded waiting time
- **THEN** it stops waiting, the check does not fail, and the run says
  the audit could not be carried out

#### Scenario: A high-severity advisory exists

- **WHEN** the audit is carried out and finds a high-severity advisory
- **THEN** its check fails

### Requirement: A release updates the lockfile it invalidates

Where a release changes a workspace's published version, the system SHALL
update the dependency lockfile in the same change, so that the lockfile
continues to describe the packages it accompanies.

The system SHALL NOT rely on an unrelated change to repair that drift
later.

Updating the lockfile during a release SHALL NOT change which dependency
versions are resolved.

#### Scenario: A release bumps a version

- **WHEN** a release changes a workspace's version
- **THEN** the lockfile records that version in the same change

#### Scenario: No release is pending

- **WHEN** no version changes
- **THEN** the lockfile is left alone

#### Scenario: A release would alter dependency resolution

- **WHEN** updating the lockfile for a release would change a resolved
  dependency version
- **THEN** that is a defect to investigate, not an expected part of
  releasing

### Requirement: The release path runs one at a time

Runs that reach the release path SHALL NOT overlap. Where a run is
already in progress for the default branch, a later one SHALL wait for it
rather than start beside it.

The jobs on that path create a pull request, a tag and a release, and
push to a publishing branch — state outside the run. Two runs racing for
it fail in ways that read as defects in the release path: a reference
that does not exist, a tag that already does.

A run in progress for the default branch SHALL NOT be cancelled by a
later one. Stopping a run between creating a tag and publishing its
release leaves a tag with nothing attached, which is worse than the race
and harder to notice than a wait.

A run for a pull request SHALL be superseded by a later run for the same
pull request. Its answer describes a commit that is no longer the one
under review.

#### Scenario: Two pushes to the default branch

- **WHEN** a push happens while a run for the default branch is in
  progress
- **THEN** the later run waits, and the earlier one finishes

#### Scenario: A release is in progress

- **WHEN** a run reaches the release path and another push arrives
- **THEN** the running release is not cancelled

#### Scenario: A pull request is pushed to again

- **WHEN** a new commit is pushed to a pull request whose run is still
  going
- **THEN** the earlier run is cancelled in favour of the new one

#### Scenario: Two unrelated pull requests

- **WHEN** runs exist for two different pull requests
- **THEN** neither waits for the other

### Requirement: The published manifest stays retrievable at the commit it was announced at

Publishing the manifest SHALL add to the publishing branch's history
rather than replace it. The branch SHALL NOT be deleted or rewritten as
part of publishing.

A consumer resolves the manifest to a commit and then fetches it by that
commit. Replacing the branch with an unrelated history makes the commit
it resolved stop existing, which the consumer cannot distinguish from the
document having been withdrawn.

Where the repository announces that a manifest was published, the
announcement SHALL identify the commit the manifest is in, not the commit
that caused the release. They are commits in different histories, and
only the first can be fetched.

#### Scenario: A second release is published

- **WHEN** the manifest is published and a manifest was published before
- **THEN** the earlier commit is still reachable, and the new one has it
  as an ancestor

#### Scenario: A consumer fetches at the announced commit

- **WHEN** a consumer fetches the manifest at the commit the
  announcement named
- **THEN** the document is retrievable there

#### Scenario: The publishing branch does not exist yet

- **WHEN** the manifest is published and no publishing branch exists
- **THEN** it is created, and subsequent publishes add to it

#### Scenario: Two publishes race

- **WHEN** two runs try to publish different manifests at once
- **THEN** one of them fails rather than silently replacing the other's
  commit

### Requirement: A changeset names a package the workspace has

A changeset naming a package that is not in the workspace SHALL fail the
repository's ordinary checks.

The release tooling already refuses such a name, but it runs only after
the merge — the job that versions pending changesets has nothing to do on
a pull request and is skipped there. A name that is wrong is therefore
found on `main`, and every subsequent merge repeats the failure until
someone reads the run.

The list of known packages SHALL be read from the workspace rather than
written down beside the check. A written list is a second place to forget
a package, which is the mistake being prevented.

#### Scenario: A changeset naming a directory rather than a package

- **WHEN** a changeset names `@openspec-ui/extension`, whose package is
  called `openspec-ui-vscode`
- **THEN** the checks fail, naming the file and the unknown package, and
  listing what the workspace does have

#### Scenario: A changeset naming every package correctly

- **WHEN** every name in every changeset resolves to a workspace package
- **THEN** the check passes

### Requirement: A release is explained in the terms of the person using it

What a release changed SHALL be written for the person who uses this
tool, not only for the person who builds it.

A package's `CHANGELOG.md` states what changed in that package. It does
not state what a capability is for, what it replaces, or how it is
reached, and a reader who does not already know a feature exists cannot
learn it from a changeset entry. Reference documentation (`HARNESS.md`,
`LIMITS.md`) is organised by configuration key, which has the same
property: it answers questions about a capability already known to the
reader.

Such a document SHALL state the version range it covers and the package
versions it was written against, and SHALL cite, for each capability it
describes, the archived change that introduced it — so a claim can be
checked against the repository rather than believed.

It SHALL NOT describe a capability that is not archived at the time it
is written.

#### Scenario: A release adds a capability a user must be told about

- **WHEN** a release adds a capability a person using the tool would
  have to be told about to use
- **THEN** it is described in the user's terms, with the command or
  screen it is reached from, and with the archived change it came from
  named

#### Scenario: A capability is proposed but not archived

- **WHEN** a capability has been proposed and not archived
- **THEN** it is absent from the document, whatever state its
  implementation is in

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

A pull request SHALL NOT merge to `main` unless every required check has
passed on it.

`main` SHALL NOT additionally require the branch to be up to date with
it. That rule cost more than it guarded here: a check run takes minutes,
another pull request lands inside that window, and the branch is stale
again before it is green. The guarantee it gave - that the checks ran on
a tree containing the current tip - is given properly by a merge queue,
which is a feature of repositories owned by an organization and is
therefore not available to this one.

What remains guaranteed: every required check ran on the change itself,
and a textual conflict with `main` still prevents a merge. What is no
longer guaranteed: that two pull requests which are green apart are green
together.

A check skipped by its own condition SHALL satisfy the requirement, so
that the version pull request is not held by the suites it does not run
and an ordinary pull request is not held by the version pull request's
check.

#### Scenario: Main moves under an open pull request

- **WHEN** another pull request merges while this one's checks have
  passed
- **THEN** this one can still merge, and nobody updates its branch for
  that reason

#### Scenario: The version pull request

- **WHEN** the version pull request's own check passes and the suites it
  does not run are skipped
- **THEN** it can merge

#### Scenario: A pull request that conflicts with main

- **WHEN** a pull request's branch conflicts textually with `main`
- **THEN** it cannot merge until the conflict is resolved

### Requirement: Publishing to the Marketplace is asked for, never inferred

The repository SHALL be able to publish a released version of
`openspec-ui-vscode` to the Visual Studio Marketplace, and SHALL do so
only when a person dispatches that publish and names the version.

No push, tag, schedule or merge SHALL start a publish. Not every release
is meant for the Marketplace, and a publish reaches every installed copy
through the editor's auto-update and cannot be taken back.

The dispatch SHALL require a confirmation the person types, and the run
SHALL refuse anything else before it reads the token.

What is published SHALL be the artifact that was released: the `.vsix`
attached to the `openspec-ui-vscode@<version>` tag's GitHub Release, which
the extension integration suite exercised. The publish SHALL NOT rebuild
the extension, and SHALL fail, naming the tag, where that release or that
asset is absent.

The Marketplace token SHALL be held as a repository secret read by the
publishing job alone, and SHALL NOT appear in any other workflow, in any
document or in any run's output.

A check SHALL fail the lint gate where the publishing workflow stops
holding to this: another trigger, a missing confirmation, a rebuild in
place of the released artifact, or a second workflow naming the token.
These guarantees live in a YAML file that no test would otherwise read.

#### Scenario: A release that is not meant for the Marketplace

- **WHEN** a version is released, tagged and published as a GitHub Release
- **THEN** nothing reaches the Marketplace until a person dispatches the
  publish for that version

#### Scenario: A dispatch without the confirmation

- **WHEN** the publish is dispatched with anything but the required word
  typed into the confirmation
- **THEN** the run fails before the token is read and nothing is published

#### Scenario: A version that was never released

- **WHEN** the publish is dispatched for a version whose tag has no release
  or whose release carries no `.vsix`
- **THEN** the run fails naming the tag, rather than building a package of
  its own

#### Scenario: A trigger added to the publishing workflow

- **WHEN** the publishing workflow gains a trigger other than the manual
  dispatch, loses its confirmation, or a second workflow names the token
- **THEN** the lint gate fails

