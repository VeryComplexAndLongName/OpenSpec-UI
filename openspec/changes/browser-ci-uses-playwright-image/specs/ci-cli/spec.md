## MODIFIED Requirements

### Requirement: The browser suite does not depend on apt sources it never reads

The standalone browser and accessibility check SHALL run in an official Playwright container matching the installed test version. The image SHALL supply Chromium and its operating system dependencies. The job SHALL run the full browser and accessibility suite.

#### Scenario: A third-party repository failing to publish

- **WHEN** an apt source on the runner image serves an index that does not match its hashes
- **THEN** the browser job can start because it does not read the runner's apt sources

#### Scenario: The dependencies Chromium needs

- **WHEN** CI starts the browser job
- **THEN** the container already includes Chromium and the operating system dependencies it needs

#### Scenario: Ubuntu package mirrors are unavailable

- **WHEN** GitHub Actions runs the standalone browser check and an Ubuntu apt mirror is unavailable
- **THEN** the job uses Chromium and its operating system dependencies from the Playwright image without contacting apt mirrors

#### Scenario: The locked Playwright version changes

- **WHEN** a pull request updates the Playwright test version installed from the lockfile
- **THEN** the browser job selects the official image for that installed version
