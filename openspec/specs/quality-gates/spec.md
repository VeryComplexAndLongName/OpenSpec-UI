# quality-gates Specification

## Purpose
TBD - created by archiving change browser-e2e-accessibility. Update Purpose after archive.
## Requirements
### Requirement: Standalone browser journeys are release-gated

The system SHALL execute the built standalone application in a managed
Chromium browser for every pull request and main-branch update,
covering not only editing artifacts but a real mutating-agent-run
lifecycle: in-order event delivery, an interrupted run's recovery and
rollback, and cross-host mutation contention.

#### Scenario: Change Editor journey succeeds in a real browser

- **WHEN** the browser opens an authenticated standalone server for a valid workspace
- **THEN** the React workbench loads without uncaught page errors
- **AND** the user can load, edit, and save a change artifact

#### Scenario: A mutating run's events render in the order they occurred

- **WHEN** a user starts an `implement` run from the AI panel
- **THEN** every event the agent produced appears in the run's event log
  in the same order it was produced, ending in a terminal state

#### Scenario: A dropped connection during a run does not crash the page

- **WHEN** the WebSocket connection is severed while a run is in progress
- **THEN** the page reports no uncaught error and simply stops receiving
  further events for that run

#### Scenario: A server stopped mid-run has no record of that run on restart

- **WHEN** the standalone server process is stopped while a mutating run
  is in progress, and a new server is started against the same
  workspace
- **THEN** the Processes list shows no entry for that run

#### Scenario: An interrupted run's recovery and rollback are reviewable in the browser

- **WHEN** a workspace's persisted journal contains a run left
  interrupted with a finalized checkpoint delta
- **THEN** the Processes and Recovery tab shows its interrupted state and
  changed files
- **AND** rolling it back restores the affected files and reports the
  result

#### Scenario: A second host's mutating run is blocked by an active workspace lease

- **WHEN** two standalone servers are open on the same workspace and one
  already holds the workspace's mutation lease with an active run
- **THEN** the other server's `implement` attempt is shown as failed in
  its AI panel, naming the host currently holding the workspace

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

