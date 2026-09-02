## ADDED Requirements

### Requirement: Tree-scoped commands honour the tree's current selection

A command that acts on a change, template or task SHALL, when invoked
without one (as the Command Palette always invokes it), act on the row
currently selected in the view that owns that kind of item. It SHALL do
so only when exactly one row is selected and it is of the kind the
command expects; otherwise it SHALL show the message it already shows
when nothing is selected.

An item passed explicitly by the tree's own right-click menu SHALL always
take precedence over the selection.

#### Scenario: One matching row is selected

- **WHEN** a tree-scoped command is invoked with no item and exactly one
  row of the expected kind is selected in the owning view
- **THEN** the command acts on that row, subject to the same state checks
  as a right-click invocation

#### Scenario: Several rows are selected

- **WHEN** the same command is invoked with no item and more than one row
  is selected
- **THEN** it does not act on any of them and reports that a selection is
  needed, because choosing one would be a decision the user did not make

#### Scenario: The selected row is of another kind

- **WHEN** a change-scoped command is invoked with no item and the sole
  selection is a task row
- **THEN** it does not act on it and reports that a selection is needed

#### Scenario: Nothing is selected anywhere

- **WHEN** the command is invoked with no item and no row is selected
- **THEN** it reports that a selection is needed, naming the right-click
  menu as the alternative

#### Scenario: Invoked from the right-click menu

- **WHEN** the command is invoked with an explicit item
- **THEN** that item is used regardless of what is selected
