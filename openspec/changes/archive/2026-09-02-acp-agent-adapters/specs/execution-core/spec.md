## MODIFIED Requirements

### Requirement: Unified command and event protocol
The system SHALL expose the same command set (`plan`, `implement`, `review`,
`status`, `cancel`, `chain`, `confirmCheckpoint`, `resolvePermission`) and
event stream (`started`, `stdout`, `stderr`, `progress`, `completed`,
`failed`, `cancelled`, `stageCompleted`, `checkpoint`, `agentUpdate`,
`permissionRequest`) regardless of which CLI agent runs and which transport
(REST/WS or message bridge) delivers results. The system SHALL NOT contain
separate execution logic implementations in protocol consumers. `chain`,
`confirmCheckpoint`, `stageCompleted`, and `checkpoint` are unchanged from
`agentic-harness-autonomy`; `resolvePermission`, `agentUpdate`, and
`permissionRequest` are additive members introduced by this change. A
transport or client that never sends `resolvePermission` and never
special-cases `agentUpdate`/`permissionRequest` sees no behavior change —
both new event kinds are non-terminal, exactly like `stageCompleted`/
`checkpoint`, so a consumer that does not recognize them can still render a
coherent (if less detailed) event log.

#### Scenario: Same command via different transports
- **WHEN** `implement` is started via REST/WS server and, separately, via a
  message bridge inside VS Code
- **THEN** both consumers receive an identical sequence of event kinds for the
  same real execution

#### Scenario: Client unaware of the new event kinds still renders a coherent log
- **WHEN** an ACP-flavored adapter's run emits `agentUpdate` and
  `permissionRequest` events alongside the existing kinds
- **THEN** a client built before this change, which does not recognize
  `agentUpdate`/`permissionRequest`, does not crash or misinterpret the run
  as terminated, because neither new kind is terminal
