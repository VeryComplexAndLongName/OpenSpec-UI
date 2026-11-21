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

### Requirement: PR Review can be tried using a built-in example

Both hosts SHALL offer Open Example without requiring a configured OpenSpec repo or agent. The example SHALL label the data as fictional and include a proposal, tasks, a committed diff and verification. The user SHALL be able to copy the example summary. Opening the example SHALL leave the workspace unchanged and SHALL NOT query GitHub or start an agent.

#### Scenario: A new user wants to see a review

- **WHEN** the user chooses Open Example before configuring OpenSpec
- **THEN** the host shows sample review content and offers Copy PR summary.

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

### Requirement: PR Review reads the origin forge and can edit scenario check associations

Both hosts SHALL read check evidence for the identified PR or merge request's published head. The report SHALL name the forge and distinguish partial visibility from absent results. For the exact checked-out revision, both hosts SHALL offer selection of a scenario and a reported check, show the resulting mapping diff, and write only on a separate confirmation if the revision and mapping still match the preview.

#### Scenario: A GitLab reviewer links a reported CI job to a scenario

- **WHEN** a published merge request head matches the reviewed commit and the reviewer chooses a job for a scenario
- **THEN** the report shows the job result and link, and confirming the preview saves the association to scenario-checks.json.

### Requirement: A reviewer can compare the change with their last review

Both hosts SHALL allow a person to mark the displayed local head as reviewed while it is still the checkout head, and compare that exact commit with a later committed head. The marker SHALL be local to the repository and change and SHALL be available from its linked worktrees. The PR target view SHALL remain available and check evidence SHALL keep its original commit identity.

#### Scenario: A reviewer returns after an agent revises a change

- **WHEN** the reviewer marks the first head, the agent commits edits and the reviewer selects Changes since last review
- **THEN** the report identifies both commits and shows the edits between the two committed trees.

### Requirement: PR Review imports bounded JUnit evidence with explicit provenance

Both hosts SHALL allow an explicit JUnit XML import and a user-declared tested commit. The importer SHALL refuse malformed XML, DTDs, oversized or excessively nested reports, and requests whose displayed head is stale. The declared commit SHALL resolve locally. Opening a review SHALL neither run tests nor import a file. Only normalized testcase identities, outcomes, import time and the declared revision SHALL be retained locally across reopening and linked worktrees; raw XML, failure text and test output SHALL NOT be retained.

#### Scenario: Import a report in either host
- **WHEN** the user selects a valid report and declares a locally known tested commit while the displayed head is current
- **THEN** normalized evidence is saved and appears when the review is reopened
- **AND** the tested revision is labelled user-declared

#### Scenario: An unsafe or stale import
- **WHEN** the XML is malformed, contains a DTD, exceeds a limit, or the displayed head moved
- **THEN** the import is refused and previously saved evidence remains unchanged

### Requirement: Scenario test evidence preserves identity and uncertainty

The review SHALL read explicit scenario-to-testcase associations from committed scenario-tests.json at the displayed head. It SHALL match exact classname/name identities and distinguish passed, failed, error, skipped, missing and ambiguous outcomes. Invalid mappings and missing associations SHALL be visible. A report declared for another commit SHALL be labelled historical and SHALL NOT establish a current passing result. The review and Copy PR summary SHALL preserve these qualifications and SHALL NOT claim coverage from a job-level check.

#### Scenario: Each testcase outcome is visible
- **WHEN** a mapped scenario has passed, failed, error, skipped, missing or duplicate testcase identities in the imported report
- **THEN** the review names each observed state and ambiguous duplicates do not count as passed

#### Scenario: A later commit is reviewed
- **WHEN** the displayed commit differs from the report's declared tested commit
- **THEN** the report is historical and no mapped scenario is presented as passing on the displayed commit

#### Scenario: Associations are missing or invalid
- **WHEN** the committed mapping is missing, malformed, duplicates a scenario or names an absent scenario
- **THEN** the report discloses the missing or invalid associations without inventing matches

### Requirement: PR Review identifies paths outside a declared change scope

For the displayed committed comparison, both hosts SHALL report paths outside the optional `change-scope.json` committed beside the proposal. Exact file paths and directory prefixes ending in a slash SHALL use case-sensitive Git paths and path boundaries. The change's own planning directory SHALL be included implicitly. The report SHALL account for both paths of a rename and retain its qualifications in Copy PR summary. Opening the review SHALL remain read-only.

#### Scenario: An agent changes an unrelated file

- **WHEN** a comparison changes files inside and outside an explicitly declared directory
- **THEN** the review identifies the outside paths and the total outside count
- **AND** it labels the result as an advisory comparison against the declaration rather than proof of requirement completion or permission enforcement

#### Scenario: A rename crosses the declared boundary

- **WHEN** a committed rename moves a file between allowed and undeclared paths
- **THEN** scope analysis considers both the old and new paths even when the displayed patch identifies a rename

#### Scenario: The declaration cannot establish agreed scope

- **WHEN** the declaration is missing, malformed, unsafe or new/changed during the comparison, or the comparison is unavailable
- **THEN** the review reports the relevant uncertainty and does not claim the change stayed within an agreed plan

#### Scenario: Only declared implementation and planning paths changed

- **WHEN** all changed paths match a valid declaration or the selected change's own planning directory
- **THEN** the review reports zero outside paths for those comparison endpoints
- **AND** it still discloses any change to the declaration itself
