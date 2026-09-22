## ADDED Requirements

### Requirement: A change's stage is derived from dated facts

`packages/core` SHALL derive a change's stage from a closed list:

- Proposed
- Planned
- In progress
- In review
- Landed
- Archived

Each stage SHALL be proved by a dated fact:

- the commit that adds `proposal.md`;
- the commit that adds `tasks.md`;
- a closed task line, dated by `git blame`, or a run in the audit log;
- the pull request's creation, or a commit on the change's branch made
  while the pull request is open;
- the pull request's merge;
- the archive commit.

A fact SHALL only move a change forward. A `sent-back` event of the
change's history SHALL move it back to the stage it names, and after it
only facts newer than the event SHALL move it on. A change with no dated
fact SHALL take its stage from its files. A merge the forge reports
without a time SHALL still make it Landed.

#### Scenario: Sent back while in review

- **WHEN** a change in review is sent back to in-progress, and a commit is
  later pushed to its branch while its pull request is open
- **THEN** it is In progress from the send-back, and In review again from
  the push

### Requirement: A change keeps every stay in every stage

The core SHALL keep each visit to a stage with when it began, when it
ended, and the fact that began it. It SHALL sum the time in each stage
over every visit. The stage a change is in now SHALL count up to the
present.

#### Scenario: Two visits to In progress

- **WHEN** a change was In progress for two hours, In review for one, and
  In progress again for two
- **THEN** its time In progress is four hours over two visits

### Requirement: A pull request carries when it opened and merged

Every forge SHALL report, with each pull request, when it was opened and
when it merged, where the forge says: GitHub through `gh` and through its
API, GitLab and Gitea. The times SHALL reach the standings unchanged. A
forge that gives no time SHALL leave the time out, and nothing is
guessed.

#### Scenario: A merged pull request on GitLab

- **WHEN** GitLab lists a merged merge request with `created_at` and
  `merged_at`
- **THEN** the pull request read for its branch carries both
