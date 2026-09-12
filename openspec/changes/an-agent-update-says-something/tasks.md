While `claude-cli-acp` works, every surface says `agent update:
assistant` and nothing else. The adapter forwards Claude's own stream
under ACP's name, and no surface shows a tool call or a plan.

Blocked by `an-agent-says-what-it-is-doing`, which is being implemented
and must be archived first.

## 1. Evidence

- [ ] 1.1 Capture a real stream from `claude` 2.1.237 run the way the
  adapter runs it, containing text, thinking, `Read`, `Edit`, a `Bash`
  that succeeds, a `Bash` that fails, `Grep` and `TodoWrite`. Save it as
  a test fixture beside `claude-acp.test.ts`, with the user's home
  directory and account name replaced. The mapping in `design.md` is
  written from knowledge of the format; this is what checks it.

## 2. The adapter

- [ ] 2.1 `translateClaudeStream` receives the run's working directory.
- [ ] 2.2 A `text` block becomes `agent_message_chunk`, ending in a line
  break.
- [ ] 2.3 A `thinking` block becomes `agent_thought_chunk`.
- [ ] 2.4 A `tool_use` block becomes `tool_call` with the title, kind,
  locations and raw input from the table in `design.md`.
- [ ] 2.5 A `tool_result` block becomes `tool_call_update` with `failed`
  or `completed` and the call's title.
- [ ] 2.6 A `TodoWrite` call becomes `plan`; its result is dropped.
- [ ] 2.7 Each translated update carries its source block under
  `_meta["openspec-ui/claude-stream-json"]`.
- [ ] 2.8 A line with nothing translated, a `system` line and a `result`
  line are forwarded as today; the `result` line still decides the
  terminal event and reports usage.

## 3. The reader

- [ ] 3.1 `describeAcpUpdate` in a leaf module beside
  `acp-streamed-text.ts`, exported from core's index and its browser
  entry.
- [ ] 3.2 It follows the table in `design.md`, and returns `undefined`
  for text chunks and for every kind it does not recognise.

## 4. The surfaces

- [ ] 4.1 `AiPanel`'s `describeEvent` uses it; the comment on
  `extractAgentUpdateText` no longer names Claude's assistant update.
- [ ] 4.2 The extension's `describe-event.ts` uses it, and shows a text
  chunk's text.
- [ ] 4.3 The CLI's `render-run.ts` prints its line on a line of its own.
- [ ] 4.4 `reportEventsToAgentStatus` in `agent-status.ts` takes its line
  as the activity.
- [ ] 4.5 `HARNESS.md`'s `claude-cli-acp` row says the adapter reports
  text, tool calls and a plan in ACP's shapes.

## 5. Tests

- [ ] 5.1 The fixture from 1.1, replayed through `translateClaudeStream`,
  yields the expected sequence of update kinds and titles.
- [ ] 5.2 Every update translated from the fixture is accepted by the
  ACP SDK's `zSessionUpdate`.
- [ ] 5.3 A line carrying only an unknown block type is forwarded
  unchanged and the run still ends as its `result` line says.
- [ ] 5.4 The existing `permission_denied` test passes unchanged; the
  test asserting `sessionUpdate === "assistant"` is rewritten to the new
  shape.
- [ ] 5.5 The reader: one test per row of its table, including a failed
  update with no title and a plan with no entry in progress.
- [ ] 5.6 The terminal prints a tool call's title, prints nothing for a
  completed update, and still breaks the line between prose and a tool
  call.
- [ ] 5.7 The panel shows a tool call's title rather than
  `agent update: tool_call`.
- [ ] 5.8 The status record's activity becomes a tool call's title.

## 6. Verification

- [ ] 6.1 This change validates strictly. `check(validate-change)`
- [ ] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 6.3 A pending changeset exists. `check(changeset-present)`
- [ ] 6.4 **Delegated to `claude-cli`**: run a real change with
  `claude-cli-acp` from the terminal and from the standalone AI panel,
  and read the status record while a `Bash` call is under way. Evidence:
  the terminal output, a picture of the panel, and the record. Unit tests
  replay a captured stream; only a live run shows what a person watching
  actually reads.
