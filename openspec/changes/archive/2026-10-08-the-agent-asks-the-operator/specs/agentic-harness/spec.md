## ADDED Requirements

### Requirement: A chain waits on its stage's question

A chain SHALL NOT start its next stage while a stage's question is open,
under every autonomy level, and SHALL go on once the stage has run again
with the answers. Under `act`, the supervisor SHALL NOT repeat or move a
stage that waits on a question.

#### Scenario: Autonomous, with a question

- **WHEN** an autonomous chain's propose stage asks a question
- **THEN** the chain does not start review until the question is answered
  and propose has run again as an update with the answer
