## MODIFIED Requirements

### Requirement: PR Review can refresh GitHub checks for the published head

Both hosts SHALL offer Refresh PR checks in PR Review for GitHub origins. On request, the review SHALL show the unique open GitHub.com PR number, base branch and revision used for the check read. It SHALL show each reported check or commit status with its observed state and any available GitHub run link. The report SHALL distinguish the published head from a different local review head and from existing local verification evidence.

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

### Requirement: PR Review associates scenarios with observed checks

The review SHALL list scenario titles from added and modified requirements in the reviewed commit. An optional committed scenario-checks.json SHALL identify a capability, requirement, scenario and named checks reported by the origin forge. The review SHALL distinguish scenarios lacking an association from associated checks lacking a result, and SHALL disclose invalid mappings. Results SHALL be tied to the reviewed commit and included in Copy PR summary.

#### Scenario: A linked check appears in GitHub results

- **WHEN** a scenario maps to a unique named check and a refresh reports it for the reviewed commit
- **THEN** the scenario row shows the check's observed state.

#### Scenario: GitHub is reading a different commit

- **WHEN** the published PR head differs from the local comparison
- **THEN** the scenario row retains the declared association and names the revision mismatch.

#### Scenario: Several results share a check name

- **WHEN** a mapped name resolves to several results on the reviewed commit
- **THEN** the scenario row reports that the result cannot be uniquely identified.

## ADDED Requirements

### Requirement: PR Review reads the origin forge and can edit scenario check associations

Both hosts SHALL read check evidence for the identified PR or merge request's published head. The report SHALL name the forge and distinguish partial visibility from absent results. For the exact checked-out revision, both hosts SHALL offer selection of a scenario and a reported check, show the resulting mapping diff, and write only on a separate confirmation if the revision and mapping still match the preview.

#### Scenario: A GitLab reviewer links a reported CI job to a scenario

- **WHEN** a published merge request head matches the reviewed commit and the reviewer chooses a job for a scenario
- **THEN** the report shows the job result and link, and confirming the preview saves the association to scenario-checks.json.
