## ADDED Requirements

### Requirement: The board's last column holds what was archived

The Pipeline's board SHALL draw, in its Archived column, the changes this
repository archived most recently, and SHALL say how many more the archive
holds.

Without this the column is empty by construction and can never be
anything else: a change leaves `openspec/changes` when it is archived, and
the board draws from the active changes. A column that can never hold
anything says nothing about the way through.

What is drawn SHALL be bounded twice: by a window of days, and by a count.
A window alone follows the pace of the work - a week of this repository is
75 archived changes, which is a wall rather than a column - and a count
alone would show a quiet repository changes archived months ago. Whatever
is not drawn SHALL be counted in one line beneath the board.

The archive SHALL be read from the default branch on the server, so that
every machine that has fetched sees the same archive. Where that branch
cannot be read - no remote, never fetched - this working directory's own
archive SHALL be read instead, and the line beneath the board SHALL say
that is where it came from. Two people looking at "the" archive and
silently seeing different things is what naming the source prevents.

The day a change was archived SHALL be read from the name of its archived
directory, which carries it. Nothing else SHALL be read for it: no commit,
no blame, no forge. A directory whose name carries no date SHALL be left
out rather than dated by a guess.

A card in the Archived column SHALL say when its change was archived and
SHALL offer no action on it.

The arrangement by declared order SHALL draw none of this: it is the order
of what can still be run, and an archived change can run no more.

#### Scenario: What was archived lately

- **WHEN** the board is drawn and changes were archived within the window
- **THEN** each stands in the Archived column, saying the day it was
  archived, with no action offered

#### Scenario: A busy week

- **WHEN** more changes were archived within the window than the count
  allows
- **THEN** the newest are drawn up to that count, and the line beneath the
  board counts every one not drawn

#### Scenario: An archive read from this working directory

- **WHEN** the default branch cannot be read
- **THEN** this working directory's archive is drawn, and the line beneath
  the board says the count is as this working directory has it

#### Scenario: The other arrangement

- **WHEN** the arrangement by declared order is chosen
- **THEN** no archived change is drawn and no count of the archive is
  shown
