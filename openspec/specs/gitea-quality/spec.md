# gitea-quality Specification

## Purpose
Enforce complete product quality gates in Gitea and bound their shared executor resources before changes can merge.

## Requirements

### Requirement: Complete Gitea quality gates
Gitea SHALL run product typechecks, lint, unit tests, build, production package
smoke, independent dependency audit/review, OpenSpec validation, native VS Code
integration/VSIX packaging and browser/accessibility checks before a regular
change can merge. Version PRs SHALL run the version/build/package path instead
of the integration suites. Quality jobs SHALL contain no production secrets.

#### Scenario: A browser check fails
- **WHEN** quality passes but the browser job fails or is unexpectedly skipped
- **THEN** the aggregate required check refuses the change

#### Scenario: Version pull request
- **WHEN** the head branch is changeset-release/main
- **THEN** version/build/package and dependency checks are required
- **AND** skipped normal integration checks cannot substitute for that job

#### Scenario: Dependency review
- **WHEN** a changed dependency node has a high or critical advisory
- **THEN** the independent dependency review refuses the change
- **AND** an advisory service outage is explicitly reported as unknown

### Requirement: Shared executor budget
OpenSpec quality jobs SHALL join the host's bounded user.slice while retaining their existing per-job CPU and memory limits and host Docker socket prohibition.

#### Scenario: Runner policy omits the shared parent
- **WHEN** the runner config removes --cgroup-parent=user.slice
- **THEN** the runner policy check rejects the configuration

#### Scenario: Quality job starts on the shared host
- **WHEN** a quality job starts after the updated runner config is deployed
- **THEN** its processes belong to user.slice under the host CPU and memory ceilings
