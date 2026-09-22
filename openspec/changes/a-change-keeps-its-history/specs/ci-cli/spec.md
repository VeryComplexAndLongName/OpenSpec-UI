## ADDED Requirements

### Requirement: The CLI records and reads a change's history

`openspec-ui-cli` SHALL offer:

- `history <change>`, which prints who holds the change and each event,
  marking any the rules refuse, and exits `1` when one does;
- `owner <change> [--to <handle>]`;
- `implementer <change> [--to <handle> | --none]`;
- `send-back <change> --stage <stage> --reason <text> [--reopen <task>:<why>]...`.

Each recording command SHALL exit `0` when the event is recorded, `1`
when the rules refuse it, and `2` when nothing could be read or written.
Without `--to`, the person named SHALL be the one this machine's key
belongs to. `--agent <id>` SHALL mark the event as that agent's.

#### Scenario: Recording before joining

- **WHEN** `owner <change>` runs on a machine whose key is in nobody's
  file
- **THEN** it exits `1` and says to join the team first

### Requirement: The merge gate checks the histories

`validate` SHALL fail on a history problem and name the file and the
reason. With `--base <ref>` it SHALL compare the histories with the base's.

#### Scenario: A history file deleted

- **WHEN** `validate --base origin/main` runs on a branch that deleted a
  history file present on `origin/main`
- **THEN** the report fails, saying history is only ever added to
