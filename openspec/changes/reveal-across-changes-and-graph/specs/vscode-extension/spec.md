## ADDED Requirements

### Requirement: A change can be located in the other view on request

Where a change is shown in more than one view, the editor SHALL offer to
locate it in the other on request, rather than requiring the reader to
find it by eye.

Locating SHALL be an explicit action by default. Following the selection
automatically SHALL be available as an opt-in setting, because a view
that shows only related changes has nothing to reveal for most of them,
and a behaviour that silently does nothing most of the time is
indistinguishable from one that is broken.

Where the change occupies more than one row — which happens when it
follows more than one other change — every row SHALL be revealed, and the
count SHALL be reported. Choosing one row on the reader's behalf hides
exactly the relationship that made the change occupy several.

Where the change does not appear in the other view at all, the action
SHALL say so plainly rather than appearing to do nothing.

#### Scenario: The change states a relation

- **WHEN** the reader asks to locate a change that appears in the
  relation view
- **THEN** that view reveals it and selects it

#### Scenario: The change occupies several rows

- **WHEN** the change follows more than one other change
- **THEN** every row for it is revealed, and the reader is told how many
  there are

#### Scenario: The change states no relation

- **WHEN** the reader asks to locate a change that the relation view does
  not show
- **THEN** the editor says the change states no relation, and no view
  changes

#### Scenario: Locating from the relation view

- **WHEN** the reader asks to locate a row from the relation view
- **THEN** the change is revealed in the list that holds it, which is the
  archive for an archived change and the active list otherwise

#### Scenario: Following the selection is not on by default

- **WHEN** the reader has not enabled it
- **THEN** selecting a change changes no other view
