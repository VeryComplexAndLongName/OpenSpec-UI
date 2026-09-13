## MODIFIED Requirements

### Requirement: Unified command and event protocol
The system SHALL expose the same command set (`plan`, `implement`, `review`,
`status`, `cancel`, `stop`, `chain`, `confirmCheckpoint`,
`resolvePermission`) and the same event stream (`started`, `stdout`,
`stderr`, `progress`, `completed`, `failed`, `cancelled`, `stageCompleted`,
`checkpoint`, `agentUpdate`, `permissionRequest`, `stopRequested`),
whichever CLI agent runs and whichever transport (REST/WS or message
bridge) delivers the results. The system SHALL NOT contain separate
execution logic in protocol consumers.

`chain`, `confirmCheckpoint`, `stageCompleted`, and `checkpoint` are
unchanged from `agentic-harness-autonomy`. `resolvePermission`,
`agentUpdate`, and `permissionRequest` are additive members. A transport or
client that never sends `resolvePermission`, and never special-cases
`agentUpdate` or `permissionRequest`, sees no change in behavior. Both of
those event kinds are non-terminal, like `stageCompleted` and `checkpoint`,
so a consumer that does not recognize them can still render a coherent,
if less detailed, event log.

`stop` and `stopRequested` are additive members in the same way. A client
that never sends `stop` sees no change in behavior, and `stopRequested` is
non-terminal.

#### Scenario: Same command via different transports
- **WHEN** `implement` is started through the REST/WS server and, separately,
  through a message bridge inside VS Code
- **THEN** both consumers receive an identical sequence of event kinds for
  the same real execution

#### Scenario: Client unaware of the new event kinds still renders a coherent log
- **WHEN** an ACP-flavored adapter's run emits `agentUpdate` and
  `permissionRequest` events alongside the existing kinds
- **THEN** a client built before those kinds existed does not crash, and does
  not treat the run as terminated, because neither kind is terminal

#### Scenario: Client unaware of a stop request
- **WHEN** a run emits `stopRequested` to a client built before it existed
- **THEN** the client does not treat the run as terminated, and still renders
  the run's terminal event when it arrives

## ADDED Requirements

### Requirement: A run can be asked to stop, and stops where the work is sound

A `stop` command SHALL ask the run it names to stop, and SHALL carry a
reason. Unless the run is waiting, the command SHALL NOT terminate the run's
process at the moment it is asked.

A run that is waiting SHALL stop at once. A run under way SHALL stop at the
first of these moments:

- its agent says it is starting another task;
- one more task of its change is ticked;
- its current stage ends.

No further stage SHALL start after the run stops.

A run that ends this way SHALL end as cancelled, and SHALL NOT be described
as stopped by a rule. Its recorded ending SHALL carry the reason and, where
known, who asked.

A `stop` naming a run the host does not have SHALL be answered as nothing to
stop, and SHALL NOT be reported as an error.

#### Scenario: At a checkpoint

- **WHEN** a stop is asked for a chain waiting at a checkpoint
- **THEN** the chain ends as cancelled at once, and its ending records the
  reason

#### Scenario: The agent starts another task

- **WHEN** a stop is asked while a stage runs, and the agent then says it is
  starting another task
- **THEN** the stage is ended at that moment, and no further stage starts

#### Scenario: A task is ticked

- **WHEN** a stop is asked while a stage runs, the agent names no other task,
  and one more task is then ticked
- **THEN** the stage is ended once the tick is seen

#### Scenario: Nothing to stop

- **WHEN** a stop names a run the host does not have
- **THEN** the answer says there was nothing to stop, and no error is
  reported

### Requirement: A stop request is visible while it is pending

When a stop is asked, the run SHALL report, before it stops, that it was
asked to stop, why, and by whom where that is known.

The run's status record SHALL say so until the run ends.

#### Scenario: A stop that waits for a tick

- **WHEN** a stop has been asked and the run has not yet reached a sound
  point
- **THEN** the run's status record says it was asked to stop, and gives the
  reason
