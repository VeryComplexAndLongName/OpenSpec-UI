## ADDED Requirements

### Requirement: The signed channel carries a conversation

The signed message directory (ADR 0028) SHALL carry, beside a request to
stop, a `note`, an `ask` and an `answer`. Each SHALL be sealed with the
sender's machine key, addressed to one run or one person, and refused as a
stop request is refused when it does not verify, is stale, or has already
been read.

Each message SHALL say what kind of sender wrote it, as `person` or `run`.
That claim SHALL NOT establish identity: only the roster and the signature
do.

A run SHALL take a message whose author is a person. A run SHALL refuse a
message whose author is a run unless its harness configuration allows
messages from runs, and SHALL record the refusal.

A `note` and an `ask` SHALL stay fresh for one day rather than for the
minute a stop request stays fresh, and SHALL be removed once delivered
rather than by the clock.

#### Scenario: A note is delivered to the run it names

- **WHEN** a person leaves a note for a run, sealed with their key
- **THEN** the run reads it at its next status renewal, records who said it
  and what was said, and removes it from the directory

#### Scenario: A message from another run is refused by default

- **WHEN** a run's message is addressed to a run whose configuration does
  not allow messages from runs
- **THEN** it is not delivered, and the refusal is recorded with its
  message id

#### Scenario: A message that does not verify is not read

- **WHEN** a message's envelope does not check out against the roster
- **THEN** its words are never parsed and it is delivered to nobody

### Requirement: A run delivers what it was told and answers what it was asked

A run SHALL deliver the messages it has taken to its agent in the prompt
context of the next stage it starts, saying who said each and when, and
marking them as words from a person rather than as content read from the
repository.

Where a message is an `ask`, the run SHALL write an `answer` addressed to
the sender when that stage ends, carrying what the agent said in that
stage, the stage's name and the run's id.

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
