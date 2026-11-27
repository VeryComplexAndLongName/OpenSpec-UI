## ADDED Requirements

### Requirement: PR Review tracks individual findings and decisions

Both hosts SHALL show a local finding list shared by worktrees of the same
repository and change. A finding SHALL retain its description, reviewed commit,
and any supplied repository-relative file and line. An explicit action SHALL
record a correction commit, a verification note and commit, a dismissal
reason, or a reopening without altering unrelated findings. The report SHALL
include these records in Copy PR summary and qualify older verification.

#### Scenario: A reviewer follows a finding through a correction

- **WHEN** a reviewer records a finding, records a later checked-out commit as its correction, and verifies it with a note
- **THEN** the review shows the finding, correction revision, verification note and tested revision

#### Scenario: A finding is dismissed

- **WHEN** a reviewer dismisses a finding with a reason
- **THEN** the outcome and reason remain visible without counting as verified

#### Scenario: Worktree or findings move during a decision

- **WHEN** the displayed head or ledger revision differs from its current value
- **THEN** the write is refused and the current ledger is preserved
