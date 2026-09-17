## ADDED Requirements

### Requirement: The Timeline tab's change is found by typing part of its name

The Timeline tab SHALL let the user find the change to show by typing part
of its name. It SHALL list, as the user types, the active and archived
changes whose name holds every word typed, and SHALL let the user choose one
with the keyboard or the mouse. Choosing SHALL load that change's timeline
at once. Active changes SHALL be listed before archived ones, and archived
ones newest first.

#### Scenario: A change among hundreds

- **WHEN** the workspace has hundreds of archived changes and the user types
  two words of one change's name
- **THEN** the list shows only the changes whose names hold both words, and
  choosing one loads its timeline

#### Scenario: Nothing matches

- **WHEN** the user types a name no change has
- **THEN** the tab says no change matches, and the timeline shown stays as
  it was

#### Scenario: Chosen with the keyboard

- **WHEN** the user moves through the matches with the arrow keys and presses
  Enter
- **THEN** the highlighted change's timeline loads, and Escape instead closes
  the list without choosing
