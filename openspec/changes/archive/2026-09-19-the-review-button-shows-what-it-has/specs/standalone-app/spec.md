## MODIFIED Requirements

### Requirement: Standalone exposes persistent process recovery

The standalone delivery SHALL display persisted process history and SHALL let
the user explicitly inspect checkpoint delta and coverage, request rollback,
and clean retained history. The inspection SHALL be shown with the run it
belongs to, and a request to inspect SHALL be visibly answered where it was
made.

#### Scenario: Interrupted process is opened in standalone

- **WHEN** the user loads Processes for the workspace
- **THEN** the UI identifies the process as interrupted and displays its recovery details

#### Scenario: User confirms rollback

- **WHEN** the checkpoint remains conflict-free
- **THEN** standalone restores the checkpoint through core and displays the rolled-back state

#### Scenario: Details open with the run they belong to

- **WHEN** the user asks to review a run in a list of many
- **THEN** the run's details, its changed files and its rollback control appear
  directly below that run's own row, and no other run's row is opened

#### Scenario: A second request replaces the first

- **WHEN** the user asks to review another run while one is open
- **THEN** the first closes and the second opens under its own row

#### Scenario: The list can be narrowed

- **WHEN** the user narrows the list by a word
- **THEN** only the runs whose operation, change, agent or state carry that
  word remain, and the view says what it is filtered by and how many of how
  many it shows
