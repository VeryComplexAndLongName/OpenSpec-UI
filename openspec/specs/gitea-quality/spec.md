# gitea-quality Specification

## Purpose
TBD - created by archiving change run-quality-in-gitea. Update Purpose after archive.

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
