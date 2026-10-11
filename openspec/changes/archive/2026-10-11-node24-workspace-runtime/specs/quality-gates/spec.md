## ADDED Requirements

### Requirement: Repository development and CI use one supported Node runtime

The root package SHALL declare a Node 24 support range beginning at 24.2 and
pin Node 24.21.0 for local development. Every GitHub and Gitea workflow that
sets up Node for this repository SHALL use Node 24.21.0. npm SHALL remain pinned
to 10.9.0 in root metadata and CI.

#### Scenario: A local runtime is selected

- **WHEN** a developer enters the repository using its declared runtime
- **THEN** Node 24.21.0 and npm 10.9.0 are selected

#### Scenario: A Node-based CI workflow runs

- **WHEN** GitHub or Gitea sets up Node for this repository
- **THEN** it selects Node 24.21.0 and installs npm 10.9.0