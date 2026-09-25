## MODIFIED Requirements

### Requirement: A change's stage is derived from dated facts

`packages/core` SHALL derive a change's stage from a closed list:

- Drafted
- Proposed
- Planned
- In progress
- In review
- Landed
- Archived

Each stage SHALL be proved by a dated fact:

- the first commit that adds anything under the change's directory, where
  it came before the commit that adds `proposal.md`;
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
fact SHALL take its stage from its files. A change with no `proposal.md`
SHALL be Drafted, whatever else its directory holds: it is a change made
before its proposal, and until one is written propose is all it wants
(ADR 0037, amended 2026-09-25). A merge the forge reports
without a time SHALL still make it Landed.

#### Scenario: Sent back while in review

- **WHEN** a change in review is sent back to in-progress, and a commit is
  later pushed to its branch while its pull request is open
- **THEN** it is In progress from the send-back, and In review again from
  the push

#### Scenario: A change made before its proposal

- **WHEN** a change's directory holds only `.openspec.yaml`, committed at
  one time, and nothing else
- **THEN** it is Drafted since that commit, and becomes Proposed when its
  proposal is committed

#### Scenario: A change committed with its proposal

- **WHEN** a change's proposal is in the first commit of its directory
- **THEN** it has no Drafted visit
