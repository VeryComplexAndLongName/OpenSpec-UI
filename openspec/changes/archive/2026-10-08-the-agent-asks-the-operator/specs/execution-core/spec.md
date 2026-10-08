## ADDED Requirements

### Requirement: An agent's question stops its run until answered

Every agent stage's instruction SHALL ask the agent to print, for each
decision it needs from the operator that the change's files do not make, a
line of its own `Question for the operator: <question>`, and not to make
that decision itself. The product SHALL read such lines as markers, and
SHALL NOT read prose for questions. Each question SHALL be emitted as a
`question` event and written to the change's `decisions.md` with its stage,
run and time and an open answer, and recorded in the audit log.

A run whose turn ended with an open question SHALL NOT complete: it SHALL
wait, saying so and writing `waiting` with kind `question` to its status
record, under every autonomy level and whether or not it is a chain's
stage. An `answerQuestion` command SHALL answer one question, writing the
answer, who gave it and when to `decisions.md` and the audit log. When every
question of the run is answered, the stage SHALL run again within the same
run, with the questions and answers in its prompt - as `update` for a `plan`
or `review` stage, as the same command otherwise - and the run SHALL end as
that does.

#### Scenario: A review with two questions

- **WHEN** a review run prints two `Question for the operator:` lines and
  ends its turn
- **THEN** two `question` events are emitted, `decisions.md` holds both as
  open, and the run waits instead of completing

#### Scenario: Answered

- **WHEN** both questions are answered
- **THEN** `decisions.md` and the audit log hold the answers, and the run
  goes on as an `update` whose prompt holds both questions and answers

### Requirement: Nothing runs past an open question

An agent command on a change whose `decisions.md` holds an open question
that is not the run's own SHALL be refused, naming the question and how to
answer it. A read-only command SHALL NOT be refused.

#### Scenario: Apply with a question open

- **WHEN** `implement` is started on a change with an open question in its
  `decisions.md`
- **THEN** it is refused, naming the question
