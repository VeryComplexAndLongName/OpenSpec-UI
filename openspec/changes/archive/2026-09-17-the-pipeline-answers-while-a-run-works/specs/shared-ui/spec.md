## MODIFIED Requirements

### Requirement: What a card says is derived in one place

A card's state, and every line a card states about its change, SHALL be
derived by one function in the core package, from the readings the host
already takes.

A host SHALL render what that function returns, and SHALL NOT derive any
part of it itself.

Where two of those readings each say which runs are live on a change, a card
SHALL take its state word and its run lines from the same one of them, so
that the word never says a change is idle beneath a line that says its run is
working.

#### Scenario: Two hosts, one change

- **WHEN** both hosts show the Pipeline for the same workspace at the same
  moment
- **THEN** each change's card states the same words in both

#### Scenario: One reading is a reading behind

- **WHEN** a run has started on a change, the survey of working directories
  has read its record, and the reading of where each change stands was taken
  before the run started
- **THEN** the card says Running above the run's activity line, and still
  states everything else that reading of where the change stands says
