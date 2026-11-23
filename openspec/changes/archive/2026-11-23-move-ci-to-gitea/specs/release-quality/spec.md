## ADDED Requirements

### Requirement: Gitea checks and publication retain distinct evidence

Required quality, security, OpenSpec, extension integration,
browser/accessibility, package-smoke and version-PR checks SHALL run in Gitea
with equivalent semantics before main/release eligibility. Registry workers
SHALL verify exact authenticated Gitea artifacts and source identities and
report outcomes to the existing Homepage queue. GitHub Release uploads SHALL
use API operations independent of GitHub Actions. A provider change SHALL NOT
invent passing evidence, rewrite an existing version or create another
independent publication authority.

#### Scenario: Gitea quality fails

- **WHEN** a required check fails or never runs
- **THEN** the change cannot merge as checked or produce an eligible publication

#### Scenario: Publisher receives altered bytes

- **WHEN** an artifact differs from its authenticated build receipt
- **THEN** publication is refused before any registry write

#### Scenario: A channel lacks working authorization

- **WHEN** its real credential and permission probes have not succeeded
- **THEN** it stays pending without a silent stored-token fallback

#### Scenario: A GitLab runner asks for card verification

- **WHEN** the abandoned GitLab preflight cannot start
- **THEN** it is not treated as evidence for CircleCI or Marketplace readiness
