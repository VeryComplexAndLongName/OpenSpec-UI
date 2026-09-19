## ADDED Requirements

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

### Requirement: What the product left behind is cleared, and what might be someone's work is not

A leftover SHALL be removed by the product only where a change of its name
is already in the archive and every file it holds is one the product itself
writes. Every other leftover SHALL be reported and left alone.

An automatic removal cannot tell an archived change's leavings from a
change somebody is about to write, and only one of those two mistakes is
recoverable.

The removal SHALL run where a workspace is read and again on a settled
interval, in every host, and SHALL be safe to run twice: a directory
already gone is not a failure. A sweep that fails SHALL be reported beside
what it found rather than raised as an error the reader must answer.

#### Scenario: Clearing an archived change's leavings

- **WHEN** the sweep finds a directory whose change is archived and which
  holds only files the product writes
- **THEN** the directory is removed, and what was removed is named

#### Scenario: Leaving a possible beginning alone

- **WHEN** the sweep finds a directory with no documents and no archived
  change of that name
- **THEN** nothing is removed, and the directory is reported with what it
  holds

#### Scenario: A sweep that cannot remove

- **WHEN** removing a leftover fails
- **THEN** the failure is reported with the rest of the reading, and the
  other leftovers are still reported

### Requirement: A working directory that is finished with is reported

Every working directory the workspace surveys SHALL say whether it is
finished with: its branch merged into the default branch or gone from the
remote, its tree clean, and no run recorded against it.

Three working directories stood beside this repository on 2026-09-18 and
two were on branches whose pull requests had merged days before. Nothing
said so, so they stayed.

A working directory SHALL NOT be removed except by a person's own action.
It can hold uncommitted work, and its installed packages may be links into
the primary directory, where a recursive delete takes the primary
directory's packages with it; that action SHALL remove such links as links
before removing the directory.

#### Scenario: A directory whose work has landed

- **WHEN** a surveyed directory's branch is merged, its tree is clean and no
  run is recorded against it
- **THEN** it is reported as finished with, naming its branch and what made
  it so

#### Scenario: A directory that still holds work

- **WHEN** a surveyed directory has uncommitted changes
- **THEN** it is not reported as finished with, whatever its branch says

#### Scenario: Removing one

- **WHEN** a person removes a working directory that was reported as
  finished with
- **THEN** its links are removed as links first, and the primary
  directory's packages are untouched
