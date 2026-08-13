## ADDED Requirements

### Requirement: Standalone exposes persistent process recovery

The standalone delivery SHALL display persisted process history and SHALL let
the user explicitly inspect checkpoint delta and coverage, request rollback,
and clean retained history.

#### Scenario: Interrupted process is opened in standalone

- **WHEN** the user loads Processes for the workspace
- **THEN** the UI identifies the process as interrupted and displays its recovery details

#### Scenario: User confirms rollback

- **WHEN** the checkpoint remains conflict-free
- **THEN** standalone restores the checkpoint through core and displays the rolled-back state
