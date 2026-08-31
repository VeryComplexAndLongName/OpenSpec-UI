## ADDED Requirements

### Requirement: `semi-autonomous` chains stages with a checkpoint between each

When a change's resolved harness config has `autonomyLevel:
"semi-autonomous"`, a `"chain"` command SHALL run `propose → review → apply
→ archive` starting from the first not-yet-complete stage, pausing after
each stage's completion and emitting a `checkpoint` event (naming the
finished stage, the next stage, and the next stage's resolved
`stepAgents` agent) instead of proceeding automatically, unless
`checkpoints.requireConfirmationBetweenSteps` resolves to `false` for that
change from a per-change `harness.json`.

#### Scenario: A semi-autonomous chain reaches a checkpoint

- **WHEN** a `"chain"` command runs for a change resolved to
  `semi-autonomous` and a stage completes with a further stage remaining
- **THEN** the system emits a `checkpoint` event and does not start the
  next stage until it receives `"confirmCheckpoint"` on the same `runId`

#### Scenario: Cancelling a paused chain

- **WHEN** `"cancel"` is sent for a `runId` currently paused at a
  checkpoint
- **THEN** the chain ends with a `cancelled` event and no further stage is
  started

### Requirement: `autonomous` chains stages with no checkpoint, and is reachable only from a per-change file

When a change's resolved harness config has `autonomyLevel: "autonomous"`,
a `"chain"` command SHALL run the same stage sequence with no pause,
emitting `stageCompleted` (not `checkpoint`) between stages. The system
SHALL refuse to start such a chain unless the change's own per-change
`openspec/changes/<id>/harness.json` — not the global file, and not any
other inherited value — itself sets `autonomyLevel: "autonomous"`.

#### Scenario: Autonomous chain resolved from a per-change file

- **WHEN** a `"chain"` command runs for a change whose own `harness.json`
  sets `autonomyLevel: "autonomous"`
- **THEN** the chain runs every stage to completion with no checkpoint
  pause, stopping after `archive`

#### Scenario: Autonomous level resolved from any other source is refused

- **WHEN** a `"chain"` command's resolved `autonomyLevel` is `"autonomous"`
  but the change's own per-change `harness.json` does not itself set that
  value
- **THEN** the system refuses to start the chain and emits a `failed` event
  citing the restriction, regardless of what the global file or any other
  inherited value states

### Requirement: A chain never invokes the `git` stepAgent

Regardless of `autonomyLevel` or `reviewGate.mode`, a `"chain"` command
SHALL stop after the `archive` stage completes (or immediately, if
`archive` was the only remaining stage) and SHALL NOT start the `git`
stepAgent under any configuration.

#### Scenario: A fully autonomous chain still stops before git

- **WHEN** an `autonomous` chain completes its `archive` stage
- **THEN** the chain ends with a `completed` event and no git action is
  taken

## MODIFIED Requirements

### Requirement: `reviewGate.mode: "agent-sufficient"` is never a valid global setting

The system SHALL reject a global `openspec/agent-harness.json` that sets
`reviewGate.mode` to `"agent-sufficient"`; that value SHALL only be
accepted in a per-change `harness.json`. The system SHALL additionally
reject a global `openspec/agent-harness.json` that sets `autonomyLevel` to
`"autonomous"`, or `checkpoints.requireConfirmationBetweenSteps` to
`false`; both SHALL only be accepted in a per-change `harness.json`.

#### Scenario: Global file attempts to set agent-sufficient

- **WHEN** `openspec/agent-harness.json` sets `reviewGate.mode:
  "agent-sufficient"`
- **THEN** the system reports a clear validation error and does not
  resolve or apply that value

#### Scenario: Global file attempts to set autonomous

- **WHEN** `openspec/agent-harness.json` sets `autonomyLevel:
  "autonomous"`
- **THEN** the system reports a clear validation error and does not
  resolve or apply that value

#### Scenario: Global file attempts to disable checkpoint confirmation

- **WHEN** `openspec/agent-harness.json` sets
  `checkpoints.requireConfirmationBetweenSteps: false`
- **THEN** the system reports a clear validation error and does not
  resolve or apply that value

#### Scenario: Per-change file sets any of the three restricted values

- **WHEN** a per-change `harness.json` sets `reviewGate.mode:
  "agent-sufficient"`, or `autonomyLevel: "autonomous"`, or
  `checkpoints.requireConfirmationBetweenSteps: false`
- **THEN** the resolved configuration for that change uses the set value,
  without affecting any other change's resolved configuration
