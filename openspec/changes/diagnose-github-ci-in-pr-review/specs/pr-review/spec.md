## ADDED Requirements

### Requirement: PR Review can refresh GitHub checks for the published head

Both hosts SHALL offer Refresh GitHub checks in PR Review. On request, the review SHALL show the unique open GitHub.com PR number, base branch and revision used for the check read. It SHALL show each reported check or commit status with its observed state and any available GitHub run link. The report SHALL distinguish the published head from a different local review head and from existing local verification evidence.

The review SHALL list required checks discovered for the PR base branch and indicate results absent from the published commit. It SHALL report when the expected list or observed results are incomplete or unavailable. Where GitHub requires a particular application, a result with an unknown or different application SHALL NOT be presented as satisfying the expectation. The review SHALL preserve the report when copying its summary.

#### Scenario: An expected check has not reported

- **WHEN** the user refreshes a GitHub PR with a completed check, a pending check and an expected check with no result for the published head
- **THEN** the review shows all three states and the links GitHub supplies for observed checks.

#### Scenario: Credentials cannot read branch rules

- **WHEN** GitHub returns head results and the branch rules cannot be fully read
- **THEN** the review shows the head results and states that the expected checks are unavailable or partial.

#### Scenario: There is no unique supported pull request

- **WHEN** a change has no unique open GitHub.com PR
- **THEN** the review explains why it cannot refresh GitHub checks and remains readable.
