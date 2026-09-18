## ADDED Requirements

### Requirement: The Timeline tab compares every change on a grid of days

The Timeline tab's comparison SHALL draw every change of the workspace on a
grid whose columns are days, without first asking which changes to compare
or over which dates.

What to compare is the question the reader came with. A mode that answers
it with a list of 264 changes and two date fields asks them to do the
work first, and shows nothing until they have.

Each change SHALL be drawn as a bar from when it was proposed to when it
was archived, placed by the hour within its day, so how long a change took
is read as a length rather than reconstructed from two markers. An active
change's bar SHALL run to a marked line for now and be distinguishable from
an archived one by more than position. A bar SHALL carry that change's task
figures beside it: how many tasks an archived change had, and how many of
how many are done in an active one.

The period SHALL be chosen from fixed choices, one of which covers the
whole history, and days that are a weekend SHALL be distinguished from
working days. A bar cut by the edge of the period SHALL be drawn as cut
rather than as beginning or ending there.

Rows SHALL be narrowable by typing part of a change's name, with the
narrowed count stated against the total. A row SHALL open that change's own
timeline.

What a project finished SHALL still be readable as a chart under the grid,
over the changes the grid is showing. The charts rest on each change's
whole history, which is read after the grid is drawn; while it is being
read, the screen SHALL say so rather than leaving the reader with an empty
space.

A change whose proposed date cannot be read SHALL keep its row, saying it
carries no dates, rather than being dropped or drawn at a guessed date.

#### Scenario: Entering the comparison

- **WHEN** the user chooses "Compare changes"
- **THEN** the workspace's changes are read once and drawn, with no
  selection or date range asked for

#### Scenario: Choosing a period

- **WHEN** the user chooses another period from the segmented control
- **THEN** the grid redraws over those days, with "All" running from the
  earliest proposed day to today

#### Scenario: An active change

- **WHEN** a change has not been archived
- **THEN** its bar runs to the line marking now, and the legend says which
  colour means active and which archived

#### Scenario: A change that began before the period

- **WHEN** a change was proposed before the first day shown and is still
  open in it
- **THEN** its row is shown with its bar cut at that edge rather than
  starting there

#### Scenario: Narrowing by name

- **WHEN** the user types part of a change's name
- **THEN** only matching rows are drawn, and the screen says how many of
  how many match

#### Scenario: Opening a change from its row

- **WHEN** the user activates a row
- **THEN** that change's own timeline is shown

#### Scenario: The charts under the grid

- **WHEN** the grid has been drawn and the histories of its changes are
  still being read
- **THEN** the screen says the charts are being read, and draws them over
  those changes once they arrive

#### Scenario: A change that cannot be dated

- **WHEN** a change carries no readable proposed date
- **THEN** its row is drawn without a bar and says it carries no dates

## REMOVED Requirements

### Requirement: The Timeline tab offers a compare-changes mode with a date-range picker

**Reason**: The mode drew nothing until the reader had picked a date range
and selected changes from a list of every change in the workspace, and the
lanes it then drew were log-scaled positions that could not be read back as
dates. ADR 0033 decision 4 draws the comparison as a grid of days over the
whole workspace.

**Migration**: The comparison is described by "The Timeline tab compares
every change on a grid of days": the period is a segmented control, the
rows are every change of the workspace, and a name is typed rather than
picked from a list.
