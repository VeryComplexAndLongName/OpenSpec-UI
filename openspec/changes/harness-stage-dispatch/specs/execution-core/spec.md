## ADDED Requirements

### Requirement: A handed-off stage is reported distinctly from a completed one

The event protocol SHALL carry a non-terminal event kind meaning "this
stage was handed to the host's own chat", distinct from the terminal
kinds. A run that hands a stage off SHALL emit it instead of a
completion, and SHALL emit no terminal event afterwards, because nothing
observes the handed-off work.

Clients that do not recognise the new kind SHALL still see a coherent
event log, as with the other non-terminal kinds.

#### Scenario: A stage is handed to the host's chat

- **WHEN** a run hands a stage to the host's chat
- **THEN** it emits a start event followed by the hand-off event, and no
  completion, failure or cancellation for that stage

#### Scenario: Terminal kinds are unchanged

- **WHEN** the set of terminal event kinds is examined
- **THEN** it still contains only completion, failure and cancellation —
  the hand-off kind is not among them
