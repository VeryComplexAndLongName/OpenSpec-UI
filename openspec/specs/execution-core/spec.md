# execution-core Specification

## Purpose
The single source of truth for product behavior: unified CLI-agent execution
protocol, execution security model, OpenSpec/git state parsing, and change
status derivation — with no HTTP or VS Code API dependency, reusable from both
the standalone server and the VS Code extension host.
## Requirements
### Requirement: Unified command and event protocol
The system SHALL expose the same command set (`plan`, `implement`, `review`,
`status`, `cancel`) and event stream (`started`, `stdout`, `stderr`,
`progress`, `completed`, `failed`, `cancelled`) regardless of which CLI agent
runs and which transport (REST/WS or message bridge) delivers results. The
system SHALL NOT contain separate execution logic implementations in protocol
consumers.

#### Scenario: Same command via different transports
- **WHEN** `implement` is started via REST/WS server and, separately, via a
  message bridge inside VS Code
- **THEN** both consumers receive an identical sequence of event kinds for the
  same real execution

### Requirement: AgentRunner abstracts specific CLI agents
The system SHALL provide one execution interface that hides differences between
specific CLI agents (Claude CLI, GitHub Copilot CLI, Codex CLI, Gemini CLI)
and local LLM via OpenAI-compatible API behind adapters, each translating
agent specifics into the same protocol event stream.

#### Scenario: Unexpected agent output format
- **WHEN** an adapter receives output that does not match expected format
  (for example after a CLI update)
- **THEN** the system forwards that output as `stdout` without data loss and
  without crashing the run

### Requirement: Repository contents are data, not executable instructions
The system SHALL pass repository file content (change proposals, issue text,
etc.) to agents strictly as context data. The system SHALL NOT allow this
content to influence command allowlist, execution cwd, or which command is
actually run.

#### Scenario: Change file contains an injected instruction
- **WHEN** `proposal.md` for a change contains text framed as an instruction
  to bypass constraints
- **THEN** it does not alter allowlist/cwd execution behavior and is included
  only as prompt content

### Requirement: Each run is constrained by allowlist and cwd sandbox
The system SHALL validate requested command/args against allowlist and working
directory against workspace boundaries before starting an agent process. The
system SHALL NOT start execution if validation fails.

#### Scenario: Attempted run outside workspace
- **WHEN** a run is requested with cwd outside the current workspace
- **THEN** the system rejects the run before spawn and emits `failed` with a
  reason

### Requirement: Each run is audited
The system SHALL write an audit log entry for every agent run (what ran, cwd,
resulting changes), regardless of success, failure, or cancellation.

#### Scenario: Run failed
- **WHEN** command execution ends with `failed`
- **THEN** the audit log still contains that run entry

### Requirement: Change status is derived in one place
The system SHALL compute change status (`draft`/`in-progress`/`implemented`/
`archived`) through one heuristic function based on change file location and
`tasks.md` state, without persisting status as a separate field.

#### Scenario: Change with partially completed tasks
- **WHEN** a change is under `openspec/changes/` (not `archive/`) and part of
  `tasks.md` checklist items are marked `[x]`
- **THEN** the system computes `in-progress`, not `draft` and not
  `implemented`

### Requirement: OpenSpec CLI JSON is validated at the core boundary
The system SHALL validate fields consumed by delivery adapters before returning
structured OpenSpec CLI results.

#### Scenario: CLI returns valid compatible output with additive fields
- **WHEN** a supported command returns all required fields plus unknown fields
- **THEN** core returns the result without discarding the additive fields

#### Scenario: CLI returns valid JSON with an incompatible shape
- **WHEN** a required consumed field is missing or has an incompatible type
- **THEN** core rejects the result with a typed compatibility diagnostic
- **AND** identifies the command and expected contract

#### Scenario: CLI returns malformed JSON
- **WHEN** a JSON command exits successfully but stdout is not valid JSON
- **THEN** core rejects the result with a typed invalid-JSON diagnostic

#### Scenario: Diagnostic includes CLI output
- **WHEN** core reports an output compatibility failure
- **THEN** the diagnostic includes only a bounded output preview
- **AND** does not expose unbounded child-process output
