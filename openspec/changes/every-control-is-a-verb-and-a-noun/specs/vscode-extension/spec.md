## MODIFIED Requirements

### Requirement: A card's name opens the change's task list where it is worked

Selecting a change's name on a Pipeline card SHALL open that change's
`tasks.md` in a new editor tab: from the change's own worktree where it has
one, otherwise from this checkout. A card's menu SHALL also offer Open
Proposal, Open Design, Show Specs, Open Worktree, which opens it in a new
window, and Copy Path. A task's Open Task SHALL open `tasks.md` at the
task's line.

#### Scenario: A change that exists only in its worktree

- **WHEN** a person selects the name of a change that exists only in its
  own worktree
- **THEN** that worktree's `tasks.md` opens in a new tab

#### Scenario: Going to a task

- **WHEN** a person chooses Open Task on task 6.4
- **THEN** `tasks.md` opens with the cursor on 6.4's line
