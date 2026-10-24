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
today's `claude-cli`, `copilot-cli`, `gemini-cli`, or `local-llm` adapters
because of an ACP-flavored adapter. ACP-flavored adapters are additional
entries, not replacements. `codex-cli` reads its CLI's own event stream and
names its sandbox (codex-cli-is-a-full-agent, ADR 0051); it still emits no
`agentUpdate` or `permissionRequest` events.

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

### Requirement: A permission's answer reaches the agent that asked, in either host

A `resolvePermission` command that names no agent SHALL be delivered, in the
standalone server as in the VS Code extension, to the runner that holds the
run it names, and never to the default runner in its place.

#### Scenario: Answering a non-default agent from the standalone AI panel

- **WHEN** a single-stage run on an ACP agent that is not the default one
  emits a `permissionRequest`, and the AI panel sends **Allow** naming no
  agent
- **THEN** that agent's runner receives the answer and the run goes on,
  and the default runner receives nothing

### Requirement: The product's own agent asks in its turn

`local-llm-acp` SHALL offer a tool `ask_operator` taking one argument,
`question`. Calling it SHALL emit a `question` event and write the question
to `decisions.md` as any question is, and SHALL block the agent's loop
until the question is answered; the answer SHALL be the tool's result, and
the turn SHALL go on. `local-llm` SHALL NOT offer it.

#### Scenario: Asking mid-turn

- **WHEN** `local-llm-acp` calls `ask_operator` with "Keep the target
  filter?" and the operator answers "Yes"
- **THEN** the loop waits until the answer, the tool's result is "Yes", and
  the agent continues its turn

### Requirement: An ACP agent's stderr is read, handed on and said beside a failure

The ACP session driver SHALL read a spawned agent's stderr from the moment
it is spawned until it exits, so that no amount of it stalls the agent. It
SHALL hand what it reads on as `stderr` events of the run, in the order it
arrived relative to the run's other events. Where the run fails, its reason
SHALL end with the last of what the agent wrote to stderr, at most 4000
characters, where the agent wrote anything there.

#### Scenario: An agent that is not signed in

- **WHEN** an ACP agent writes "Error: not signed in" to stderr and closes
  its connection before answering
- **THEN** the run carries that line as a `stderr` event, and its failure
  says "The agent's stderr ended with:" followed by that line

#### Scenario: An agent that writes a great deal to stderr

- **WHEN** an ACP agent writes more to stderr than its pipe holds while it
  works
- **THEN** it is not stalled by it, and every chunk reaches the run's
  events

### Requirement: Codex CLI runs in a named sandbox and reports what its stream says

The `codex-cli` adapter SHALL run `codex exec --json` and SHALL always name
the sandbox: `workspace-write` for a command whose stage writes the change
(`plan`, `implement`, `update`, `verify`) and `read-only` for every other
command. The allowlist SHALL refuse an invocation that names no sandbox,
names `danger-full-access`, or bypasses approvals and the sandbox.

The adapter SHALL pass a stage's `model` with `--model`. Before codex
starts, it SHALL read codex's model catalog (`codex debug models`) once a
process and SHALL refuse a model the catalog does not list
(`OSW-AGT-011`) and an effort the model does not take (`OSW-AGT-012`),
naming what there is; where the catalog cannot be read, the choice SHALL
be left to codex. `codex-cli` SHALL accept the efforts `low`, `medium`,
`high`, `xhigh` and `max`. It SHALL tell the
stream's agent messages, the commands the agent runs, a failed command's
exit code with the end of its output, and the files it changed, as the
run's text; SHALL report the turn's usage as tokens, with cached input
apart from input; and SHALL fail a run whose turn the stream reports
failed, though `codex` exits 0 (`OSW-AGT-222`).

#### Scenario: An apply stage on codex

- **WHEN** an `implement` command runs on `codex-cli`
- **THEN** `codex` is run with `--sandbox workspace-write`, and the files
  it writes in the change's directory are written

#### Scenario: A review on codex

- **WHEN** a `review` command runs on `codex-cli`
- **THEN** `codex` is run with `--sandbox read-only`

#### Scenario: Full access refused

- **WHEN** an invocation of `codex` names `--sandbox danger-full-access`, or
  none
- **THEN** the allowlist refuses it and nothing is run

#### Scenario: A model codex does not have

- **WHEN** a stage on `codex-cli` names the model `gpt-x`, and codex's
  catalog (`codex debug models`) lists `gpt-6.1-sol` and `gpt-6-luna`
- **THEN** the stage fails before codex starts, with "codex has no model
  \"gpt-x\"; its models are gpt-6.1-sol, gpt-6-luna"

#### Scenario: An effort the model does not take

- **WHEN** a stage on `codex-cli` names `gpt-6-luna` and the effort
  `ultra`, which that model's catalog entry does not list
- **THEN** the stage fails before codex starts, naming the efforts the
  model takes

#### Scenario: A turn that failed

- **WHEN** the stream reports `turn.failed` with "model gpt-x is not
  available" and `codex` exits 0
- **THEN** the run fails with "codex reported the turn failed: model gpt-x
  is not available"

### Requirement: An ACP agent's settings are session options, checked then set

An ACP adapter MAY name session options for its run. The shared ACP
session driver SHALL check every named option against the `configOptions`
the agent's `session/new` answer lists, and only when every one is listed,
with the named value among its values, SHALL set each with
`session/set_config_option`, in order, before the prompt. An option the
session does not list SHALL fail the run with `OSW-AGT-223`, and a value
it does not list for that option with `OSW-AGT-224`, each naming what the
session does list; in either case no option SHALL be set and no prompt
sent.

#### Scenario: Options set before the prompt

- **WHEN** a run names `mode` = `workspace-write` and `model` =
  `gpt-6-luna`, and the session lists both with those values
- **THEN** both are set, in that order, and the prompt is sent after them

#### Scenario: A value the session does not list

- **WHEN** a run names `model` = `gpt-x`, and the session lists the models
  `gpt-6.1-sol` and `gpt-6-luna`
- **THEN** the run fails with "codex-acp takes the model values
  gpt-6.1-sol, gpt-6-luna, not \"gpt-x\"", and nothing is set or prompted

#### Scenario: An option the session does not list

- **WHEN** a run names `reasoning_effort`, and the session lists only
  `mode` and `model`
- **THEN** the run fails with `OSW-AGT-223`, naming `mode` and `model`

### Requirement: Codex over ACP runs in a named sandbox, with the stage's model and effort

The `codex-cli-acp` adapter SHALL start `codex-acp` with no arguments and
SHALL name, as session options: `mode`, the sandbox `codex-cli` names for
the same command (`workspace-write` for plan, implement, update and
verify, `read-only` otherwise); `model`, where the stage names one; and
`reasoning_effort`, where the stage names one. It SHALL never use
`codex-acp`'s `agent` or `agent-full-access` mode. `codex-cli-acp` SHALL
accept a model and the efforts `low`, `medium`, `high`, `xhigh` and
`max`.

#### Scenario: An apply stage on codex over ACP

- **WHEN** an `implement` command runs on `codex-cli-acp` with the model
  `gpt-6.1-sol` and the effort `low`
- **THEN** the session's `mode` is set to `workspace-write`, its `model` to
  `gpt-6.1-sol` and its `reasoning_effort` to `low`, before the prompt

#### Scenario: A review on codex over ACP

- **WHEN** a `review` command runs on `codex-cli-acp`
- **THEN** the session's `mode` is set to `read-only`

### Requirement: An ACP agent's cached input is recorded by the schema's names

The shared ACP session driver SHALL read a prompt answer's cached input
from ACP's `Usage` fields `cachedReadTokens` and `cachedWriteTokens`, and
SHALL record them as the run's cache-read and cache-creation input tokens.

#### Scenario: Codex's answer with cached input

- **WHEN** a prompt's answer carries `inputTokens` 6186,
  `cachedReadTokens` 32512, `cachedWriteTokens` 0 and `outputTokens` 86
- **THEN** the run's usage records 6186 input, 32512 cache-read and 0
  cache-creation input tokens, and 86 output tokens
