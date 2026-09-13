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

### Requirement: Streamed text is shown as the prose it was written as

Where an agent streams a reply as a run of updates each carrying a
slice of text, the surface SHALL join those slices and show one piece
of prose.

A slice is cut wherever the agent happened to flush, which is routinely
mid-sentence and sometimes mid-word. Rendering each slice as its own
element shows the reader the transport rather than the answer.

Slices SHALL join with nothing inserted between them. A slice is not a
line, and a separator placed between two of them breaks a word.

Only slices of the same kind SHALL join. Text an agent offers as its
message and text it offers as its thinking are different statements,
and running them together shows one that was never made.

An update carrying anything other than streamed text SHALL NOT join,
and SHALL end the run of slices around it. A tool call that happened
between two sentences happened between them, and the transcript SHALL
say so.

An update whose shape is not recognised as streamed text SHALL be left
exactly as it is. The payload is carried verbatim from a protocol this
system does not own, and guessing at an unfamiliar shape turns an
addition to that protocol into mangled output.

#### Scenario: A reply arriving in slices

- **WHEN** an agent streams a reply as several text updates, one of
  which ends mid-word
- **THEN** the surface shows one piece of text, with no break inside
  the word

#### Scenario: Thinking and speaking

- **WHEN** text offered as thinking arrives beside text offered as a
  message
- **THEN** they are shown as two pieces, not one

#### Scenario: A tool call between sentences

- **WHEN** a tool call arrives between two text updates
- **THEN** three things are shown, in the order they happened

#### Scenario: An update of an unfamiliar shape

- **WHEN** an update carries a kind this system does not recognise
- **THEN** it is shown as it is, and joins nothing

### Requirement: The Claude CLI adapter reports in ACP's own shapes

The `claude-cli-acp` adapter SHALL translate Claude's stream into ACP
session updates wherever ACP has a counterpart: text as
`agent_message_chunk`, thinking as `agent_thought_chunk`, a tool use as
`tool_call`, and a tool result as `tool_call_update`.

A translated update SHALL be valid against ACP's own session update
schema.

A `tool_call` SHALL carry a human-readable title naming what the tool
acts on, and a `tool_call_update` SHALL carry the same title.

A line from which nothing could be translated SHALL be forwarded as it
was before this requirement, and SHALL NOT change the run's outcome.

#### Scenario: The agent reads a file

- **WHEN** Claude uses its `Read` tool on a file inside the run's working
  directory
- **THEN** the run emits an `agentUpdate` whose update is a `tool_call`
  with kind `read` and a title naming that file relative to the working
  directory

#### Scenario: A command fails

- **WHEN** a tool result reports an error
- **THEN** the run emits a `tool_call_update` for that call with status
  `failed` and the call's title

#### Scenario: The agent writes to the person

- **WHEN** Claude sends a message containing text
- **THEN** the run emits an `agent_message_chunk` carrying that text, and
  the surfaces show it as prose

#### Scenario: A block nobody has seen

- **WHEN** a line carries only a content block of a type the adapter does
  not recognise
- **THEN** the line is forwarded as before and the run continues

### Requirement: A tool call and a plan are shown as what they say

Every surface that shows a run's progress — the AI panel, the VS Code
output channel and the terminal's text output — SHALL show a tool call by its title, a failed tool call as failed with
its title, and a plan by its progress and its current step.

These SHALL NOT be shown only as the name of their update kind.

An update from which nothing can be read — no text, and no tool call,
failure or plan — SHALL NOT be shown on those surfaces, and SHALL still
reach every consumer of the event stream.

How an update is read SHALL depend only on ACP's shapes, and SHALL NOT
depend on which agent produced it.

#### Scenario: The panel during a Claude run

- **WHEN** a `claude-cli-acp` run edits a file
- **THEN** the AI panel shows a line naming the edit and the file, not
  `agent update: assistant`

#### Scenario: The terminal during a run

- **WHEN** a run started from the terminal emits a `tool_call`
- **THEN** the terminal prints its title on a line of its own

#### Scenario: Claude's own bookkeeping

- **WHEN** a `claude-cli-acp` run emits a `system` or `rate_limit_event`
  update, or reports that a tool call completed
- **THEN** no panel and no output channel shows an entry for it, and the
  run's JSON-lines output still carries it

#### Scenario: A native ACP agent

- **WHEN** a native ACP agent emits a `tool_call` with a title
- **THEN** it is shown exactly as the same update from `claude-cli-acp`
  is shown

