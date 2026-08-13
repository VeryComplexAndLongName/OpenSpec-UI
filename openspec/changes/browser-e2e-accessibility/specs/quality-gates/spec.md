## ADDED Requirements

### Requirement: Standalone browser journeys are release-gated
The system SHALL execute the built standalone application in a managed Chromium
browser for every pull request and main-branch update.

#### Scenario: Change Editor journey succeeds in a real browser
- **WHEN** the browser opens an authenticated standalone server for a valid workspace
- **THEN** the React workbench loads without uncaught page errors
- **AND** the user can load, edit, and save a change artifact

### Requirement: Serious accessibility regressions fail CI
The system SHALL scan the stable standalone workbench state using an established
accessibility engine.

#### Scenario: Browser state contains a serious accessibility violation
- **WHEN** the automated accessibility scan reports a serious or critical violation
- **THEN** the browser quality job fails with violation details

#### Scenario: Browser journey fails
- **WHEN** the browser journey does not complete
- **THEN** CI retains diagnostic artifacts for investigation