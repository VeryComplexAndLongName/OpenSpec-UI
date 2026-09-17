## ADDED Requirements

### Requirement: When every change was proposed and archived is readable in one pass

When each change of a workspace was proposed and archived, and how many of
its tasks are done, SHALL be readable in one pass over the workspace, at a
cost that does not grow by a git call per change.

A screen that compares a workspace's changes needs every change's dates
before it can draw anything. Read one change at a time, this repository's
264 changes cost 62 seconds, measured on 2026-09-17 — a screen nobody
waits for, and the same measurement that made the archive's dates a single
call one level down.

Every date the pass returns SHALL carry the source it was read from, and
SHALL be assembled by the same rule as a date read for one change: a
commit before a naming convention, an absent date reported as absent, and
the day as its own record states it.

Where the pass reads a date differently from the per-change read, it SHALL
be a difference of how the evidence was gathered and not of what the date
means. Reading when a change's `proposal.md` first appeared at that
change's own path, rather than following the file through renames, reports
a later instant for a change renamed after it was proposed; both are
commits, both name that as their source, and the day is the same.

A change that cannot be dated SHALL still be returned, with its dates
absent, rather than dropped from a reading that claims to cover the
workspace.

#### Scenario: Reading a whole workspace's dates

- **WHEN** the dates of a workspace's changes are read in one pass
- **THEN** every active and archived change is returned with its proposed
  date, its archived date, the source of each, and its done and total task
  counts

#### Scenario: An archived change

- **WHEN** a change was moved under `archive/` by a commit
- **THEN** its archived date comes from that commit and says so, and its
  proposed date comes from the commit that added its proposal

#### Scenario: A change nobody has committed

- **WHEN** a change exists only in the working tree
- **THEN** it is returned with its proposed date absent and its source
  saying there is nothing to read it from

#### Scenario: A workspace with no history

- **WHEN** the workspace is not a git repository
- **THEN** every change is returned with its dates absent, rather than the
  read failing
