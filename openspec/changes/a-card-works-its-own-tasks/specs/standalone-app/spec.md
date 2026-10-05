## ADDED Requirements

### Requirement: A card's name opens the change's tasks in a new browser tab

Selecting a change's name on a Pipeline card in the standalone app SHALL
open a new browser tab that shows that change's tasks, each whole, with the
controls its card offers, read from the change's own worktree where it has
one and from this checkout otherwise. "Go to line" SHALL scroll that tab to
the task and mark it.

#### Scenario: Opening a change's tasks

- **WHEN** a person selects a change's name on its card
- **THEN** a new browser tab shows the change's tasks, and the session is
  the same session
