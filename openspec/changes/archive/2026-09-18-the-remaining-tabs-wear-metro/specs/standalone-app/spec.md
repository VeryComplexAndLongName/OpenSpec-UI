## ADDED Requirements

### Requirement: Every tab is drawn from the shared components

Every tab of the standalone shell SHALL be drawn from the shared
components, not only the tabs a mockup drew: a panel that names what it
holds, one toolbar for the tab's controls, a table for rows, a badge for a
state or an origin, and the panel's own words when there is nothing to
show.

Five tabs were left on the pre-redesign markup when the mockup's screens
were redrawn — Run a Command, Processes, Diff Preview, Change Editor and
Templates. Read on 2026-09-18, none of them had a panel head, every control
row was the old one, two tables were the old class, four headings sat loose
in a panel, the Change Editor rolled its own tab strip, and Templates drew
nothing at all until a button was pressed. A product where half the screens
are one thing and half another is a product that looks unfinished, whatever
each half is worth on its own.

Redrawing a tab SHALL NOT change what it is driven by: the name, role and
test handle of every control stay as they are, so that a screen's markup
can be moved without moving what a person or a test reaches for.

Where the same markup is drawn inside a host editor, the mapping that gives
it the editor's colours SHALL move with it, and a token left unmapped SHALL
fail a check rather than reach a screen.

#### Scenario: A tab names what it holds

- **WHEN** any tab of the shell is shown
- **THEN** its content sits in panels whose heads name them, rather than in
  one unnamed block

#### Scenario: A tab's controls

- **WHEN** a tab offers controls that act on the whole tab
- **THEN** they sit in one toolbar of the same shape every other tab uses

#### Scenario: Rows and states

- **WHEN** a tab lists rows carrying a state, an origin or a kind
- **THEN** the rows are a table and the state is a badge, as the redesigned
  lists draw them

#### Scenario: Nothing to show

- **WHEN** a tab has nothing to list, including before anything has been
  loaded
- **THEN** its panel says so, rather than drawing nothing

#### Scenario: The same markup in the editor

- **WHEN** a screen the extension also draws is redrawn
- **THEN** the editor's own colours still reach it, and a token the editor
  layer fails to map fails a check
