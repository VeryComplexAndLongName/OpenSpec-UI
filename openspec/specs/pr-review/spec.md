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
