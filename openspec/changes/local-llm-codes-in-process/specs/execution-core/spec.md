## ADDED Requirements

### Requirement: The local model makes a change with nothing installed

`local-llm-acp` SHALL be an Agent Client Protocol agent that runs inside
`packages/core` and is driven by `AcpSessionDriver`, with no process
started and nothing to install besides the product. It SHALL run a tool
loop against the local LLM's `/v1/chat/completions`, with the base URL and
key the local LLM settings resolve. It SHALL report each piece of the
model's text, each tool call and each tool result as ACP updates, and the
tokens the model reported as usage. Its loop SHALL be bounded by the
`LOCAL_LLM_ACP_*` limits: iterations, tool calls, seconds, command
timeout, command output, and tokens.

#### Scenario: A run that edits code

- **WHEN** an `implement` command runs on `local-llm-acp` against a model
  that calls `write_file`
- **THEN** the file is written in the run's `cwd`, a `tool_call` and its
  `tool_call_update` reach the run's events, and the run completes

#### Scenario: A limit is reached

- **WHEN** the model keeps calling tools past the iteration limit
- **THEN** the run stops and says which limit stopped it

### Requirement: The local agent's tools stay in the run's directory

The tools of `local-llm-acp` SHALL read, write and search only inside the
run's `cwd`. A path SHALL be refused when its real location, links
resolved, is outside the real location of `cwd`. A command SHALL run in
`cwd`, SHALL be ended at the command time limit, and its output SHALL be
cut at the output cap. Where the host's `askBeforeCommands` setting is on,
a command SHALL run only after a permission request is allowed.

#### Scenario: A path outside the directory

- **WHEN** the model asks to read `../outside.txt`, an absolute path
  elsewhere, or a link that resolves outside `cwd`
- **THEN** the tool answers with an error naming the path, and nothing
  outside `cwd` is read or written

#### Scenario: Asking before a command

- **WHEN** `askBeforeCommands` is on and the model calls `run_command`
- **THEN** a `permissionRequest` naming the command reaches the run's
  events, and the command runs only if it is allowed

### Requirement: A tool call is read wherever the model put it

The local agent SHALL take a model's structured `tool_calls`. Where an
answer carries none, it SHALL take a call written in the text inside
`<tool_call>`, in Qwen3-Coder's `<function=...><parameter=...>` form or as
Hermes' JSON, provided the tool was offered, and SHALL remove it from the
text. A parameter written as text SHALL be read as JSON only where the
tool declares an array or an object.

#### Scenario: A server whose parser does not match the model

- **WHEN** an answer's text holds `<tool_call><function=read_file><parameter=path>src/a.js</parameter></function></tool_call>`
  and `tool_calls` is empty or null
- **THEN** the agent calls `read_file` with path `src/a.js`

#### Scenario: A tool that was not offered

- **WHEN** the text names a tool that was not offered
- **THEN** no call is made and the text is kept

### Requirement: The local model is named or found

For `local-llm` and `local-llm-acp`, the model SHALL be the stage's model
where the stage names one; else the one the local LLM settings name; else
the model the server lists at `/v1/models`, the only one where it serves
one and the first where it serves several; else `default`. A run SHALL
say, in its first update, which model it uses and where the name came
from.

#### Scenario: Nothing names a model

- **WHEN** no stage, setting or environment variable names a model, and
  the server's `/v1/models` lists `QuantTrio/Qwen3.6-35B-A3B-AWQ`
- **THEN** the run uses that model and says it came from the server

#### Scenario: The stage names one

- **WHEN** the stage's entry names a model and the settings name another
- **THEN** the run uses the stage's

### Requirement: An agent can be told to ignore the system proxy

A host SHALL offer one switch, off by default, that tells agents to ignore
the system proxy: an editor setting, and `OPENSPEC_UI_IGNORE_SYSTEM_PROXY`
for the standalone server and the CLI. When it is on, the local LLM
agents and the local LLM's availability check SHALL connect directly
through a connection pool of their own. Each CLI agent SHALL be started
with `HTTP_PROXY`, `HTTPS_PROXY` and `ALL_PROXY` removed from its
environment, in either case, and `NO_PROXY=*`. Each agent's capability row
SHALL say whether it honours the switch: `ignored`, `environment` or
`unknown`.

#### Scenario: The switch is on

- **WHEN** the switch is on and `HTTPS_PROXY` is set in the host's
  environment
- **THEN** the local LLM is reached directly, and a CLI agent's
  environment has no proxy variable and has `NO_PROXY=*`

#### Scenario: The switch is off

- **WHEN** the switch is off
- **THEN** every agent's environment and connections are what they were
  before this requirement
