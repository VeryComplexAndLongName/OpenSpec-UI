# acp-agent-adapters Specification

## Purpose
Lets `AgentRunner` consumers receive structured, agent-reported progress and
(where the underlying agent supports it) permission requests for `copilot-cli`,
`gemini-cli`, `codex-cli`, and `claude-cli`, instead of only opaque
`stdout`/`stderr` text, by speaking the Agent Client Protocol (ACP) to each
agent's own ACP-capable process.
## Requirements
### Requirement: ACP session driver translates agent updates into the project event stream

The system SHALL provide one ACP session driver, shared by every ACP-flavored
`AgentAdapter`, that opens an ACP session against the adapter's underlying
process and translates each `session/update` notification it receives into
an `agentUpdate` event on the same `runId` as the run's other events.

#### Scenario: Structured tool-call update surfaces without raw-text scraping
- **WHEN** an ACP-capable agent process emits a `session/update` describing a
  tool call in progress
- **THEN** the run's event stream contains an `agentUpdate` event carrying
  that structured payload, and no `stdout` event is required to convey the
  same information

### Requirement: Permission requests are surfaced only where the underlying agent genuinely supports them

The system SHALL emit a `permissionRequest` event only for an ACP-flavored
adapter whose underlying agent process actually issues ACP
`session/request_permission` calls. An adapter for an agent that does not
issue such calls SHALL NOT synthesize one.

#### Scenario: Claude CLI adapter never emits a permission request
- **WHEN** the `claude-cli` ACP-flavored adapter runs a prompt that causes the
  underlying `claude` process to attempt a file write
- **THEN** the run's event stream contains no `permissionRequest` event for
  that attempt (the underlying process resolves the permission decision
  itself, fail-closed, before the driver ever sees a request to relay)

#### Scenario: Permission request answered
- **WHEN** an ACP-flavored adapter that does support `session/
  request_permission` emits a `permissionRequest` event
- **THEN** a `resolvePermission` command naming that request's id and an
  `"allow"` or `"deny"` outcome resolves the underlying ACP request, and no
  second `permissionRequest` is emitted for the same action

### Requirement: An ACP-flavored adapter is presence-detected like any other CLI adapter

The system SHALL treat the external binary or package an ACP-flavored
adapter depends on (for example, an externally installed `codex-acp`) the
same way it already treats `claude`/`copilot`/`codex`/`gemini`: detected on
`PATH` on a best-effort basis, never required for the product to install or
start, and reported as `failed` with a clear reason if a run is attempted
against an agent that is not actually present.

#### Scenario: Selected ACP agent's binary is not installed
- **WHEN** a run is started against an ACP-flavored adapter whose required
  external binary is not found
- **THEN** the run ends with a `failed` event naming the missing binary,
  and no other adapter's availability is affected

### Requirement: Existing raw-text adapters are unaffected

The system SHALL NOT change the behavior, event shape, or output handling of
today's `claude-cli`, `copilot-cli`, `codex-cli`, `gemini-cli`, or
`local-llm` adapters. ACP-flavored adapters are additional entries, not
replacements.

#### Scenario: Non-ACP adapter still used by an existing consumer
- **WHEN** a client selects today's `claude-cli` adapter (not its ACP-flavored
  counterpart)
- **THEN** the run behaves exactly as before this change, with no
  `agentUpdate` or `permissionRequest` events

