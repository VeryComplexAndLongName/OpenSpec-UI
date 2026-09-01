## ADDED Requirements

### Requirement: The chain reviews the implementation after applying it

The chain SHALL run a verification stage after the stage that implements a
change and before the stage that archives it. The stage SHALL have its own
configurable agent, resolved through the same global and per-change
configuration as every other stage.

The verification stage SHALL examine the implementation against the
change's tasks and its specification delta, and SHALL record any task whose
stated verification does not hold as not done.

This stage SHALL NOT be described or relied upon as sufficient
verification. Tasks that an implementing agent cannot perform remain
outstanding for a human, unchanged.

#### Scenario: A chain reaches verification

- **WHEN** a chain completes the stage that implements a change
- **THEN** it runs the verification stage next, before archiving

#### Scenario: Verification finds an overstated task

- **WHEN** the verification stage finds a task recorded as done whose
  stated verification does not hold
- **THEN** that task is recorded as not done, and the chain does not
  archive the change

#### Scenario: A stage agent is not configured for verification

- **WHEN** no agent is configured for the verification stage
- **THEN** it resolves the same way an unconfigured stage resolves today

#### Scenario: Resuming a change whose tasks are all done

- **WHEN** a chain is started for a change whose tasks are all recorded as
  done and which is not yet archived
- **THEN** it starts at the verification stage rather than at archiving

### Requirement: The verifying agent is given what the run changed

The prompt for a verification stage SHALL carry the set of files the
implementing run changed, in a section distinct from the change's own
content.

That set SHALL be scoped to the run being verified. The system SHALL NOT
substitute the state of the whole working tree, which may contain unrelated
work.

Where the set does not fit the prompt, it SHALL be reduced and the prompt
SHALL state that it was reduced and by how much. It SHALL NOT be omitted
silently.

#### Scenario: The changed files are available

- **WHEN** a verification stage runs after an implementing run whose
  changes are known
- **THEN** its prompt carries those files in their own section

#### Scenario: The changed files are not available

- **WHEN** the changes of the run being verified cannot be determined
- **THEN** the prompt is built as it would be without them, and the stage
  still runs

#### Scenario: More changed files than the prompt can carry

- **WHEN** the changed files exceed what the prompt can carry
- **THEN** the prompt carries as many as it can and states how many were
  omitted

### Requirement: A stage's instruction describes the stage's actual position

Each stage's instruction to its agent SHALL describe the work available at
the point in the chain where that stage runs.

#### Scenario: The stage that runs before implementation

- **WHEN** the stage that runs before a change is implemented instructs its
  agent
- **THEN** the instruction describes reviewing the change's proposal, not
  an implementation that does not exist yet
