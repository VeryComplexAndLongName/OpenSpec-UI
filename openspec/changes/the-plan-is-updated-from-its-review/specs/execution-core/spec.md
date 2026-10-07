## ADDED Requirements

### Requirement: An update revises the plan from its review

The protocol SHALL have a command kind `update`. An `update` run SHALL be
instructed to revise the change's existing planning artifacts so that they
answer the review and the notes it is given, to keep them coherent, to
validate the change strictly, and to change no code and no file outside
the change's directory. Its prompt SHALL carry the result of the change's
latest completed review run from the audit log, or say there is none, and
the notes the operator gave when starting it, both framed as data.

#### Scenario: Updating after a review

- **WHEN** a change's last completed review run found five things to fix,
  and the operator starts `update` with a note
- **THEN** the update's prompt holds that review's result and the note, and
  the run may change the change's artifacts and nothing else

### Requirement: A review says whether the plan is ready

The review instruction SHALL ask the agent to end its reply with a line of
its own, `Review verdict: ready` or `Review verdict: changes needed`. The
product SHALL read that line as a marker, at the start of a line, the last
one winning, and SHALL record it on the run's terminal event and audit
entry as `reviewVerdict`. A reply with no such line SHALL have no verdict;
prose SHALL NOT be read for one.

#### Scenario: A review that asks for changes

- **WHEN** a review run's reply ends with `**Review verdict: changes needed**`
- **THEN** its terminal event and its audit entry carry
  `reviewVerdict: "changes-needed"`
