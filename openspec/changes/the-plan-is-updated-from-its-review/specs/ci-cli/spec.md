## ADDED Requirements

### Requirement: The CLI updates a plan

`openspec-ui-cli update <change> [--note <text>] [--agent <id>] [--cwd
<path>]` SHALL run `update` on the change, with the note in its prompt,
printing the run as `openspec-ui-cli run` prints one, and SHALL exit
non-zero where the run fails.

#### Scenario: A note from the terminal

- **WHEN** `openspec-ui-cli update demo --note "keep the target filter"` runs
- **THEN** the update's prompt holds the last review of `demo` and the note
