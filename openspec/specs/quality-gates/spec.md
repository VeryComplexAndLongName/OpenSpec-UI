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

### Requirement: A check whose cost varies with the machine states its own budget

Where a check's duration depends on how busy the machine is — because it
does filesystem work, spawns processes, or builds fixtures — it SHALL
carry a time budget chosen from a measurement of that check, and SHALL
NOT rely on the default budget intended for fixed-cost unit tests.

The measurement the budget was chosen from SHALL be recorded with it, so
a later failure can be told from a budget that was never justified.

A budget SHALL be raised only where the check has been established to be
slow rather than stalled. Where a check makes no progress, the system
SHALL treat that as a defect to diagnose rather than a budget to widen.

#### Scenario: The machine is busy

- **WHEN** the suite runs while other work occupies the machine
- **THEN** a check whose cost varies still completes within its budget,
  and reports on the behaviour it asserts

#### Scenario: A check stalls rather than slows

- **WHEN** a check makes no progress rather than running slowly
- **THEN** widening its budget is not the remedy, and the stall is
  diagnosed

#### Scenario: The behaviour under test regresses

- **WHEN** what a check asserts is actually violated
- **THEN** it fails on that, not on time

### Requirement: A check whose cost grows with the repository carries its own budget

Where a check's work grows with the size of the repository — reading
every file of a kind, rather than a fixed set — it SHALL be given a time
budget chosen for that growth, and SHALL NOT rely on the default budget
intended for fixed-cost unit tests.

The budget SHALL be recorded alongside the measurement it was chosen
from, so that a later failure can be told apart from a budget that was
never justified.

Such a check SHALL fail only on the behaviour it asserts, and SHALL NOT
fail because the repository has grown since the budget was set.

#### Scenario: The repository grows

- **WHEN** files of the kind the check reads are added
- **THEN** the check still completes within its budget and reports on the
  behaviour it asserts

#### Scenario: The check runs alongside the rest of the suite

- **WHEN** the check runs under full-suite load rather than alone
- **THEN** its budget still accommodates it

#### Scenario: The behaviour under test regresses

- **WHEN** what the check asserts is actually violated
- **THEN** it fails on that, not on time

### Requirement: The time-budget rule is enforced by a check, not by memory

Where the repository requires a cost-varying check to state its own time
budget, that requirement SHALL be verified mechanically as part of the
lint gate, rather than relying on an author remembering it.

The verification SHALL name the file it rejects and say what is missing,
so the author can act on it without reading the spec first.

A check that matches the mechanical signal but is genuinely fixed-cost
SHALL be recorded as an explicit exemption with a stated reason, rather
than being made to carry a budget it does not need or silencing the
verification for everything.

#### Scenario: A new cost-varying check omits its budget

- **WHEN** a test that does filesystem work, spawns a process, or builds
  fixtures is added without a stated time budget
- **THEN** the lint gate fails and names that file

#### Scenario: A fixed-cost check matches the signal

- **WHEN** a check matches the mechanical signal but its cost does not
  vary with the machine
- **THEN** it is recorded as an exemption with a reason, and the lint
  gate passes

#### Scenario: The rule is met

- **WHEN** every cost-varying check states a budget or is a recorded
  exemption
- **THEN** the lint gate passes and reports nothing

