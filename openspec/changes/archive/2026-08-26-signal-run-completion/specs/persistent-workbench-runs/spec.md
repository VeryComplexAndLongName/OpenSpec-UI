## ADDED Requirements

### Requirement: Terminal agent-run state triggers a host notification

For `plan`/`implement`/`review` runs specifically -- not the deterministic
`status`/`list`/`show`/`validate` commands -- each delivery target SHALL
notify the user through its host's own native notification mechanism when
the run reaches a `completed` or `failed` terminal state, so a user who is
not actively watching the Processes view or the AI panel still learns the
run finished. `cancelled`, `interrupted`, and `rolled-back` terminal
states SHALL NOT trigger a notification.

#### Scenario: An agent run completes while the user is not watching

- **WHEN** a `plan`/`implement`/`review` run reaches the `completed` state
- **THEN** the host shows a notification identifying the operation, the
  change, and its summary

#### Scenario: An agent run fails

- **WHEN** a `plan`/`implement`/`review` run reaches the `failed` state
- **THEN** the host shows a notification identifying the operation, the
  change, and the failure reason

#### Scenario: Deterministic commands do not notify

- **WHEN** a `status`/`list`/`show`/`validate` run reaches a terminal
  state
- **THEN** no notification is shown

#### Scenario: Cancellation, interruption, and rollback do not notify

- **WHEN** a run is cancelled, restored as interrupted, or rolled back
- **THEN** no notification is shown

#### Scenario: A restored run from a prior session does not re-notify

- **WHEN** a host activates and loads process history that was already in
  a terminal state before this activation
- **THEN** no notification is shown for any of those already-terminal
  processes
