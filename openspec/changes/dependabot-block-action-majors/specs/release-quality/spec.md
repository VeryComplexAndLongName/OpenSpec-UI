## MODIFIED Requirements

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
