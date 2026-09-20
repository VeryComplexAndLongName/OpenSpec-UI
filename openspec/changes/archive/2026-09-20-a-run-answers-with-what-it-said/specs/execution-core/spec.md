## MODIFIED Requirements

### Requirement: A run delivers what it was told and answers what it was asked

A run SHALL deliver the messages it has taken to its agent in the prompt
context of the next stage it starts, saying who said each and when, and
marking them as words from a person rather than as content read from the
repository.

Where a message is an `ask`, the run SHALL write an `answer` addressed to
the sender when that stage ends, carrying what the agent said in that
stage, the stage's name and the run's id. What the agent said SHALL be the
stage's closing summary where it has one, and otherwise the tail of what
the stage streamed, bounded in length. Only a stage that said nothing at
all SHALL answer that it said nothing.

#### Scenario: A note reaches the next stage

- **WHEN** a note is taken while a stage is running
- **THEN** the next stage's prompt carries it, with who said it and when

#### Scenario: A question is answered when the stage ends

- **WHEN** an ask is taken and the stage that carried it ends
- **THEN** an answer addressed to the asker is written, carrying what the
  agent said, the stage and the run id

#### Scenario: A run that ends before a stage starts

- **WHEN** a run takes a note and then ends without starting another stage
- **THEN** the note is recorded as taken and undelivered, and no answer is
  invented

#### Scenario: A stage with no closing summary

- **WHEN** the stage that carried a question ends without a summary of its
  own, having streamed what it did
- **THEN** the answer carries the tail of what it streamed rather than
  reporting that the stage said nothing
