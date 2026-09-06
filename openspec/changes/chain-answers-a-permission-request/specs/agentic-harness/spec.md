## ADDED Requirements

### Requirement: A permission request raised inside a chain can be answered

Where a stage's agent asks for permission to act, the answer SHALL reach
the run that asked. A chain SHALL route a permission answer to the runner
executing the stage in flight, rather than treating it as a request to
start work.

The answer SHALL identify the request by the id the asking run published,
not by the id of the chain that contains it. A surface that answers with
the containing run's id names a request no driver is waiting for, which
is indistinguishable from not answering at all.

A surface that displays a chain SHALL offer the control that answers,
since that is where the request becomes visible. A request displayed
without a way to answer it strands the run.

Where a permission request is raised and nothing can answer it — because
the configured autonomy provides no confirmation channel — the run SHALL
fail, naming the request and the reason no answer is possible. It SHALL
NOT wait: a wait that cannot end is indistinguishable from a hang, and
leaves killing the process as the only remaining action.

#### Scenario: The operator answers a request from a chain

- **WHEN** a stage's agent asks for permission and the operator answers
- **THEN** the answer reaches that stage's run and the stage continues

#### Scenario: The answer names the stage, not the chain

- **WHEN** an answer is sent for a request raised by a stage
- **THEN** it identifies the request by the id that stage published

#### Scenario: Nothing can answer

- **WHEN** a stage's agent asks for permission and the configured
  autonomy provides no way to answer
- **THEN** the run fails, naming the request and why no answer is
  possible

#### Scenario: An answer arrives for a request already resolved

- **WHEN** an answer names a request that is no longer pending
- **THEN** it is ignored, and no second request is raised for the same
  action
