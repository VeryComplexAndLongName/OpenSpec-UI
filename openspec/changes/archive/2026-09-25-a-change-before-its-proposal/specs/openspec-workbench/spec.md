## MODIFIED Requirements

### Requirement: A directory with no documents is not a change

A directory under `openspec/changes/` that carries none of a change's
documents — no proposal, no design, no task list and no spec deltas — SHALL
NOT be listed as a change.

Listing one is how two archived changes came back as "No tasks" beside real
work on 2026-09-18: `openspec archive` moved their documents and left the
`harness.json` the settings panel had written, and every directory under
`openspec/changes/` was a change.

It SHALL be readable as what it is instead: a leftover, carrying the names
of the files it holds, whether every one of them is a file the product
writes, and whether a change of the same name is already archived.

Where a caller asks for drafts, as the Pipeline's reading of what can be
started does, a directory with no documents whose name was never archived
SHALL be read as a change: somebody's start, Drafted until its proposal is
written (ADR 0037, amended 2026-09-25). One whose name was archived SHALL
stay a leftover. The Pipeline drew no card for a change made before its
proposal, so propose, the one thing it wants, could not be started from
it (reported by a user on 2026-09-24).

#### Scenario: A directory holding only what the product wrote

- **WHEN** a change has been archived and its directory still holds a file
  the product wrote
- **THEN** the workspace's changes do not include it, and it is reported as
  a leftover naming that file

#### Scenario: A change being started by hand

- **WHEN** a directory holds a change's schema declaration and nothing else
- **THEN** it is reported as a leftover carrying a file the product does not
  write, and nothing about it says it can be cleared

#### Scenario: A change with documents

- **WHEN** a directory holds any of the change's documents
- **THEN** it is a change, whatever else it holds

#### Scenario: A change being started, read for the Pipeline

- **WHEN** a directory holds a change's schema declaration and nothing else,
  nothing of its name is archived, and drafts are asked for
- **THEN** it is read as a change

#### Scenario: A leftover, read for the Pipeline

- **WHEN** a directory holds only a file the product wrote, a change of its
  name is archived, and drafts are asked for
- **THEN** it is not read as a change
