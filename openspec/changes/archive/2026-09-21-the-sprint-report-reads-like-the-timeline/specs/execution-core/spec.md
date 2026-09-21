## ADDED Requirements

### Requirement: The sprint report reads its changes as the timeline does

`packages/core` SHALL build a sprint report from timelines read in
batches, with the archive's dates read once for the whole request, as the
Timeline tab reads them. It SHALL read the authorship of every change from
one git call over `openspec/changes`, counting the commits that touched a
file under each change's directory. Only when that call cannot be made
SHALL it ask per change, and then in batches.

A list of timelines SHALL date each change's proposal from one git call
over `openspec/changes` that lists every commit adding or moving a file
there, following moves as `git log --follow` does. A change that call does
not know SHALL be dated on its own.

Measured on 2026-09-21 over this repository's 296 archived changes: the
report took 109 s when it read every change at once and asked git for each
archive date and each authorship separately.

#### Scenario: The whole archive is selected

- **WHEN** a sprint report is asked for over every archived change
- **THEN** no more than a batch of changes is read at once
- **AND** the archive's dates, the proposals' first commits and the
  changes' authorship are each read by one git call

#### Scenario: A change was moved into the archive

- **WHEN** a commit moved a change's directory under `archive/`
- **THEN** that commit counts toward the archived change's authorship, as
  it does in the per-change read

#### Scenario: Git cannot be asked

- **WHEN** the one authorship call fails
- **THEN** each change's authorship is read on its own, and the report is
  still made

#### Scenario: A change was renamed before it was archived

- **WHEN** a change's directory was renamed and then archived
- **THEN** its proposal is dated from the commit that first added it,
  under its first name
