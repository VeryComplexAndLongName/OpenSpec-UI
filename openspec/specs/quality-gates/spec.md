# quality-gates Specification

## Purpose
TBD - created by archiving change browser-e2e-accessibility. Update Purpose after archive.
## Requirements
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

### Requirement: New repository-authored text follows the English policy
The system SHALL fail the normal lint gate when a tracked authored file contains
new or modified unapproved Cyrillic text.

#### Scenario: Tracked source contains Cyrillic text
- **WHEN** a tracked Markdown, source, JSON, or YAML file contains Cyrillic text
- **AND** its path and normalized content do not match the reviewed legacy baseline
- **THEN** the lint gate fails with file and line diagnostics

#### Scenario: Reviewed legacy line remains unchanged
- **WHEN** a tracked line matches its reviewed baseline path and content hash
- **THEN** the scanner reports no new policy violation

#### Scenario: Intentional internationalization fixture is marked
- **WHEN** a fixture line contains Cyrillic text and an explicit policy marker
- **THEN** the scanner accepts that line

#### Scenario: Real CLI output fixture contains repository prose as data
- **WHEN** the scanner encounters the explicitly exempt captured CLI JSON fixture
- **THEN** it leaves the fixture byte-for-byte unchanged

#### Scenario: Generated files exist locally
- **WHEN** ignored build, dependency, or editor-test output contains Cyrillic text
- **THEN** the tracked-file scanner does not inspect that output
