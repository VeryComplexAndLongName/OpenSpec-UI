# pr-review Specification

## Purpose
Give reviewers a committed branch comparison and the verification evidence they need before accepting an OpenSpec change.

## Requirements

### Requirement: An active change can be reviewed against its PR target

Both hosts SHALL offer Show PR Review on an active change. The review SHALL compare the committed head of the change's working directory against its merge base with the open PR's target when available. The view SHALL identify the head, base and comparison source, disclose excluded working-tree changes and identify a local head different from the PR head when known.

#### Scenario: Open PR targets a release branch
- **WHEN** the change has an open PR targeting a different branch from the repository default
- **THEN** the review shows committed branch changes since the merge base with that release branch
- **AND** it identifies edits excluded from that comparison and a different published head when present

#### Scenario: Default-branch preview before a PR
- **WHEN** the open PR target is unknown and a default branch is available locally
- **THEN** the review identifies the default-branch comparison as a preview and explains why the PR target was unavailable

#### Scenario: A known target cannot be compared
- **WHEN** the known PR target or a common ancestor is missing locally
- **THEN** the review reports the missing comparison and does not substitute another branch

### Requirement: Verification records state what they establish

The review SHALL show retained mechanical outcomes and verify-agent outcomes for the selected change with their run and time. It SHALL identify mechanical results for the reviewed commit, for another commit, or for an unknown revision and report missing evidence. Opening the review SHALL not execute checks or modify the repository.

#### Scenario: Recorded, legacy and missing evidence
- **WHEN** retained verification evidence is read for the selected change
- **THEN** a matching recorded revision is labelled with the reviewed commit, a different revision as historical and an absent revision as unknown
- **AND** an agent outcome is identified independently of mechanical checks
- **AND** a missing record is shown as missing evidence

### Requirement: The reviewer can copy a PR summary

Both hosts SHALL let the user copy a Markdown summary of the displayed comparison and recorded verification results to the clipboard. The summary SHALL preserve comparison and evidence qualifications and exclude the raw patch and raw command output.

#### Scenario: Copy matches the open review
- **WHEN** the reviewer selects Copy PR summary
- **THEN** the clipboard contains the change, base, head, file summary and reported verification evidence for the open review
- **AND** the product confirms a successful copy or shows the failure

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

### Requirement: PR Review associates scenarios with observed checks

The review SHALL list scenario titles from added and modified requirements in the reviewed commit. An optional committed scenario-checks.json SHALL identify a capability, requirement, scenario and named checks. The review SHALL distinguish scenarios lacking an association from associated checks lacking a result, and SHALL disclose invalid mappings. Results SHALL be tied to the reviewed commit and included in Copy PR summary.

#### Scenario: A linked check appears in GitHub results

- **WHEN** a scenario maps to a unique named check and a refresh reports it for the reviewed commit
- **THEN** the scenario row shows the check's observed state.

#### Scenario: GitHub is reading a different commit

- **WHEN** the published PR head differs from the local comparison
- **THEN** the scenario row retains the declared association and names the revision mismatch.

#### Scenario: Several results share a check name

- **WHEN** a mapped name resolves to several results on the reviewed commit
- **THEN** the scenario row reports that the result cannot be uniquely identified.
