## ADDED Requirements

### Requirement: A row the tree rebuilds carries the same facts as the row it drew

Where the extension answers "what is this element's parent", the row it
returns SHALL carry the same state as the row built from the workspace,
and SHALL NOT substitute a fixed value for a fact it did not look up.

A row's description and icon are how a person reads its state. A rebuilt
row that answers the question with a written-in value shows a state
nothing derived, and shows it in the same place the derived one appears.
VS Code renders what this answer returns — it restores the tree's
selection through the parent chain after a window reload — so the
substitution is visible, not internal.

Where no parent is known, the answer SHALL be that there is none, rather
than a row assembled from defaults.

#### Scenario: The parent of an artifact under a finished change

- **WHEN** the parent of an artifact belonging to a change whose tasks
  are all done is asked for
- **THEN** the row returned reads as implemented, the same as the row
  the tree drew

#### Scenario: An artifact belonging to no change

- **WHEN** the parent of a workspace-level artifact is asked for
- **THEN** there is none, and no row is assembled
