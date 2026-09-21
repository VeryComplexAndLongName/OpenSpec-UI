## ADDED Requirements

### Requirement: The Pipeline panel opens a change's run logs

The extension SHALL hand its runners the workspace's run logs, so every
run it starts keeps one. Its Pipeline panel SHALL offer Logs on every
change's card and show the same view the standalone shows. It reads
through the bridge operations `pipeline/run-logs` and `pipeline/run-log`,
which answer from the panel's own workspace root. A request that names no
change, or no valid run id, SHALL be refused by name.

#### Scenario: A person opens a change's logs in the editor

- **WHEN** a person presses Logs on a card in the Pipeline panel
- **THEN** the panel lists the change's runs and shows the newest run's log

#### Scenario: A request names a path

- **WHEN** the panel is asked for the log of run `../audit`
- **THEN** it answers that a run id is required, and reads nothing
