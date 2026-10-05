## ADDED Requirements

### Requirement: A task is closed, reopened and committed from a terminal

`openspec-ui-cli task done <change> <number> [--note <text>]`, `task
reopen <change> <number> [--note <text>]` and `task commit <change>` SHALL
do what a card's controls do, under the same rules, in the change's own
worktree. They SHALL exit 0 on success, 1 on a refusal with its reason, and
2 where the request could not be attempted.

#### Scenario: Closing a Human-only task from a terminal

- **WHEN** `task done the-change 6.4 --note "seen"` is run
- **THEN** 6.4 is ticked with the note under it, and the command exits 0

#### Scenario: Without the note it needs

- **WHEN** `task done the-change 6.4` is run and 6.4 is Human-only
- **THEN** nothing is written, the reason is printed, and the command
  exits 1
