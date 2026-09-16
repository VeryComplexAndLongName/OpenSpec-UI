## ADDED Requirements

### Requirement: The OpenSpec view summary is laid out as ADR 0033's mockup

The standalone shell's OpenSpec view summary SHALL present, in this order:
four tiles — the active changes, the archived changes with the latest day
one was archived, the specs with their total requirements, and the items
waiting on a person — each with its figure and a note; a panel of the active
changes, each row giving the change's name, its state as a word, its task
progress as a bar with the done and total counts, and the day it was last
modified; and, side by side, the specs with the most requirements and the
most recently archived changes, each able to show its full list.

Dates on the summary SHALL be shown as days a person reads, with the full
timestamp still available. Nothing the summary offered before — the full
archive and its search, every spec, the waiting list with its run controls
and enrolment requests, where the workspace was read from — SHALL be removed.

#### Scenario: A workspace with active and archived changes

- **WHEN** the summary has read a workspace with active changes, archived
  changes and specs
- **THEN** it shows the four tiles, the changes panel, and the specs and
  recently archived panels side by side

#### Scenario: The full archive

- **WHEN** the person asks for all archived changes
- **THEN** every archived change is listed, with the search it had before

#### Scenario: A change's row

- **WHEN** a change has done 25 of 27 tasks and was last modified on 16
  September
- **THEN** its row shows a bar, "25 / 27" and "16 Sep"

#### Scenario: A workspace with no specs and nothing archived

- **WHEN** the summary has read a workspace with no specs and no archived
  changes
- **THEN** the specs panel says there are no specs and the recently archived
  panel says nothing is archived, neither drawing a table with no rows
