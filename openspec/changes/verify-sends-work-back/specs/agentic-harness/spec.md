## ADDED Requirements

### Requirement: A chain acts on its own verification result

Where verification leaves tasks unchecked and the stage that implements
them may be attempted again, the chain SHALL return to that stage rather
than continue to a stage whose precondition it has just been shown does
not hold.

Verification is the only stage that produces a machine-checked statement
that earlier work is unfinished, so this SHALL be the only return: a
chain otherwise runs forward.

The return SHALL be bounded by the same attempt count that bounds every
other reason a stage is attempted again, and SHALL record why it
happened, so that a stage appearing twice is distinguishable from a
duplicate.

Where no attempts remain, or where the implementing stage is not part of
this chain, the chain SHALL stop and SHALL name the tasks that are still
unchecked — the reader is about to take the work over, and a count alone
sends them to open the file.

Where no attempt count is configured, the chain SHALL behave as it did
before: verification leaves the tasks unchecked and the archive step
refuses them.

#### Scenario: Verification leaves work unfinished

- **WHEN** verification completes with tasks unchecked and attempts
  remain
- **THEN** the chain returns to the implementing stage, recording that
  verification is why

#### Scenario: The attempts are used up

- **WHEN** the implementing stage has used every attempt it is allowed
  and tasks are still unchecked
- **THEN** the chain stops and names those tasks

#### Scenario: The chain never ran the implementing stage

- **WHEN** a chain entered at verification leaves tasks unchecked
- **THEN** it stops and names them, rather than running a stage it was
  not asked to run

#### Scenario: Nothing is configured

- **WHEN** no attempt count is configured and verification leaves tasks
  unchecked
- **THEN** the chain continues as before and the archive step refuses
