## ADDED Requirements

### Requirement: Tree-scoped commands give explicit feedback when invoked without a selection

Every command that requires a tree item (a change, template, or task row)
to act on SHALL show a dismissible message instead of silently doing
nothing when invoked without one — including invocation via the Command
Palette, which passes no tree item.

#### Scenario: A tree-scoped command is invoked from the Command Palette with nothing selected

- **WHEN** a command that requires a change/template/task tree item is
  invoked with no item argument (e.g. via the Command Palette)
- **THEN** a warning message names the kind of item required (e.g.
  "select a change in the tree first") instead of the command silently
  returning with no observable effect

#### Scenario: No workspace is open

- **WHEN** a tree-scoped command is invoked with no workspace folder open
- **THEN** an error message says to open a folder or workspace first,
  instead of silently returning

#### Scenario: A valid tree item is passed

- **WHEN** a tree-scoped command is invoked with a valid item from an
  actual right-click on the tree
- **THEN** its existing behavior is unchanged
