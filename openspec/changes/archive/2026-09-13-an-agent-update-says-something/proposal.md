# An agent update says something

## Why

While `claude-cli-acp` works, every surface repeats the same line:
`agent update: assistant`, `agent update: user`, `agent update: assistant`.
The AI panel, the VS Code output channel and the terminal all know that
an update arrived, and nothing about what it said. A run that is reading
files, editing them and running tests looks exactly like a run that is
stuck.

What the agent did is inside the event. It is lost in two places.

**`claude-cli-acp` does not speak ACP.** Claude has no ACP mode
(ADR 0013), so the adapter runs `claude -p --output-format stream-json`
and forwards each line as an `agentUpdate` whose `sessionUpdate` is the
line's own `type`. Everything downstream is written for ACP. The reader
that joins streamed text looks for `agent_message_chunk` and finds
`assistant`, so not even the agent's own words are shown.

**No surface shows a tool call or a plan.** Apart from streamed text, an
update is printed as its kind, or not at all. Yet `tool_call`,
`tool_call_update` and `plan` are the most useful things an ACP agent
reports while it works: which file, which command, which step. That is
true of the native ACP agents too, not only of Claude.

And `an-agent-says-what-it-is-doing` is about to depend on this. Its
status record carries what a run says it is doing, taken from streamed
text. For `claude-cli-acp` that is nothing, so the line meant to tell a
working agent from a hung one stays empty for the agent this repository
runs most.

## What Changes

- `claude-cli-acp` **completes its imitation of ACP**. It translates
  Claude's stream into the session updates a native ACP agent sends:
  text as `agent_message_chunk`, thinking as `agent_thought_chunk`, a tool
  use as `tool_call` with a readable title, and its result as
  `tool_call_update`. What has no ACP
  counterpart passes through as it does today. Knowledge of Claude's
  format stays in that one adapter.
- **One reader in core** turns an ACP update into a line for a person: a
  tool call's title, a failed tool call, a plan's progress and current
  step. It knows ACP and no particular agent.
- **Every surface uses it**: the AI panel, the VS Code output channel and
  the terminal. The status record's activity line takes it too, in
  `an-agent-says-what-it-is-doing`: that record is not on `main` yet, so
  it adopts the reader when it lands rather than this change reaching
  into code that does not exist.
- Streamed text is unchanged: it is still read by `readAcpStreamedText`
  and still joined into prose.

## Impact

- `packages/core` — `agents/claude-acp.ts` translates into ACP shapes; a
  new leaf module reads an update into a line.
- `packages/webui` — `AiPanel` describes an update with it.
- `packages/extension` — `describe-event.ts` describes an update with it.
- `packages/cli` — `render-run.ts` prints tool calls, failures and plan
  progress.
- `HARNESS.md` — the `claude-cli-acp` row says what the adapter reports.
- No change to the event protocol, the native ACP adapters, the ACP
  session driver, the raw-text adapters, or how a run ends and reports
  usage.
