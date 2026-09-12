## ADDED Requirements

### Requirement: The Claude CLI adapter reports in ACP's own shapes

The `claude-cli-acp` adapter SHALL translate Claude's stream into ACP
session updates wherever ACP has a counterpart: text as
`agent_message_chunk`, thinking as `agent_thought_chunk`, a tool use as
`tool_call`, a tool result as `tool_call_update`, and the todo list as
`plan`.

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
output channel, the terminal's text output, and a run's status record —
SHALL show a tool call by its title, a failed tool call as failed with
its title, and a plan by its progress and its current step.

These SHALL NOT be shown only as the name of their update kind.

How an update is read SHALL depend only on ACP's shapes, and SHALL NOT
depend on which agent produced it.

#### Scenario: The panel during a Claude run

- **WHEN** a `claude-cli-acp` run edits a file
- **THEN** the AI panel shows a line naming the edit and the file, not
  `agent update: assistant`

#### Scenario: The terminal during a run

- **WHEN** a run started from the terminal emits a `tool_call`
- **THEN** the terminal prints its title on a line of its own

#### Scenario: What the status record says

- **WHEN** a run emits a `tool_call` while it writes a status record
- **THEN** the record's activity is that call's title

#### Scenario: A native ACP agent

- **WHEN** a native ACP agent emits a `tool_call` with a title
- **THEN** it is shown exactly as the same update from `claude-cli-acp`
  is shown
