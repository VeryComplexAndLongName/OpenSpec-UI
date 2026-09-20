## ADDED Requirements

### Requirement: A run from the terminal takes what the operator said

A chain run started from the terminal SHALL take the notes and questions
addressed to it through the signed channel, on the same renewal that reads
a request to stop, and SHALL write the answers it owes. It SHALL do so
under the same rules a run started from the editor follows, including the
refusal of a message written by another run.

#### Scenario: A note is left for a run started from the terminal

- **WHEN** a person leaves a note for a run started with `run <change>`
- **THEN** the run takes it, records who said it, and carries it into the
  next stage's prompt

#### Scenario: A question to a run started from the terminal

- **WHEN** a person asks a question of such a run, and the stage that
  carried it ends
- **THEN** an answer addressed to them is written to the signed channel
