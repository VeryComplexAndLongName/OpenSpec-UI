## ADDED Requirements

### Requirement: The CLI updates a plan

`openspec-ui-cli update <change> [--note <text>] [--agent <id>] [--cwd
<path>]` SHALL run `update` on the change, with the note in its prompt,
printing the run as `openspec-ui-cli run` prints one, and SHALL exit
non-zero where the run fails. An agent's permission request SHALL be put to
the person at the terminal, as `run` puts a checkpoint; where the input is
not a terminal, it SHALL be denied, and the denial printed.

#### Scenario: A note from the terminal

- **WHEN** `openspec-ui-cli update demo --note "keep the target filter"` runs
- **THEN** the update's prompt holds the last review of `demo` and the note

#### Scenario: An agent asks for a permission

- **WHEN** the update's agent asks to edit `tasks.md` and nobody is at a
  terminal to answer
- **THEN** the request is denied, the denial is printed, and the run goes on
  instead of waiting for an answer
