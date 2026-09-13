## ADDED Requirements

### Requirement: A run can be asked to stop from the terminal, and the asker is named

The CLI SHALL ask a run, named by its instance identity, to stop, with a
reason, by writing a signed request with this machine's key.

It SHALL refuse to ask a run that has no live record.

The run SHALL name the asker from the key's enrolment, as it does for a
request sent from a card.

#### Scenario: Asking a live run

- **WHEN** `stop` names a live run and gives a reason
- **THEN** a signed request is written, and its identifier is printed

#### Scenario: A run that is not live

- **WHEN** `stop` names an instance with no live record
- **THEN** nothing is written, and the command says why and exits with a
  failure
