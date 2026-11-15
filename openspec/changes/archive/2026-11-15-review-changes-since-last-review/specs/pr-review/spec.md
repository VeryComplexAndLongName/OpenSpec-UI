## ADDED Requirements

### Requirement: A reviewer can compare the change with their last review

Both hosts SHALL allow a person to mark the displayed local head as reviewed while it is still the checkout head, and compare that exact commit with a later committed head. The marker SHALL be local to the repository and change and SHALL be available from its linked worktrees. The PR target view SHALL remain available and check evidence SHALL keep its original commit identity.

#### Scenario: A reviewer returns after an agent revises a change

- **WHEN** the reviewer marks the first head, the agent commits edits and the reviewer selects Changes since last review
- **THEN** the report identifies both commits and shows the edits between the two committed trees.
