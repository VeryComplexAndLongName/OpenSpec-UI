While `claude-cli-acp` works, every surface says `agent update:
assistant` and nothing else. The adapter forwards Claude's own stream
under ACP's name, and no surface shows a tool call or a plan.

## 1. Evidence

- [x] 1.1 Capture a real stream from `claude` 2.1.237 run the way the
  adapter runs it, containing text, thinking, `Read`, `Edit`, a `Bash`
  that succeeds, a `Bash` that fails, `Glob` and `Grep`. Save it as a
  test fixture beside `claude-acp.test.ts`, with the user's home
  directory and account name removed. The mapping in `design.md` was
  first written from knowledge of the format; this is what checks it.
  What it corrected is recorded in `design.md`, "What a real stream
  showed".
  Captured 2026-09-13 with `claude-sonnet-5`, effort `medium`, as
  `packages/core/src/agents/fixtures/claude-2.1.237-stream.jsonl`: 30
  lines, of which only the init line was reduced (to its type, working
  directory — replaced — session, tools, model, permission mode, key
  source, version and id). The agent asked for `TodoWrite` twice through
  `ToolSearch`, found none, and said so; both thinking blocks are empty.

## 2. The adapter

- [x] 2.1 `translateClaudeStream` receives the run's working directory.
- [x] 2.2 A `text` block becomes `agent_message_chunk`, ending in a line
  break.
- [x] 2.3 A `thinking` block becomes `agent_thought_chunk`.
- [x] 2.4 A `tool_use` block becomes `tool_call` with the title, kind,
  locations and raw input from the table in `design.md`.
- [x] 2.5 A `tool_result` block becomes `tool_call_update` with `failed`
  or `completed` and the call's title.
- [x] 2.6 A `thinking` block with no text sends nothing, and a line whose
  every block was recognised and sent nothing is not forwarded either.
- [x] 2.7 Each translated update carries its source block under
  `_meta["openspec-ui/claude-stream-json"]`.
- [x] 2.8 A line with nothing translated, a `system` line and a `result`
  line are forwarded as today; the `result` line still decides the
  terminal event and reports usage.

## 3. The reader

- [x] 3.1 `describeAcpUpdate` in a leaf module beside
  `acp-streamed-text.ts`, exported from core's index and its browser
  entry. `packages/core/src/acp-update-line.ts`.
- [x] 3.2 It follows the table in `design.md`, and returns `undefined`
  for text chunks and for every kind it does not recognise.

## 4. The surfaces

- [x] 4.1 `AiPanel`'s `describeEvent` uses it; the comment on
  `extractAgentUpdateText` no longer names Claude's assistant update.
- [x] 4.2 The extension's `describe-event.ts` uses it, and shows a text
  chunk's text.
- [x] 4.3 The CLI's `render-run.ts` prints its line on a line of its own.
- [x] 4.4 Moved to `an-agent-says-what-it-is-doing` task 3.2: its status
  record takes its activity from this reader. That record is not on
  `main` — it exists only as that change's uncommitted work — so it
  adopts the reader when it lands. Closed by that change, not this one.
- [x] 4.5 `HARNESS.md`'s `claude-cli-acp` row says the adapter reports
  text, tool calls and a plan in ACP's shapes. Written in "What changes
  when an `-acp` id is chosen", item 1, which is where the table's reader
  is sent for what an `-acp` id changes.

## 5. Tests

- [x] 5.1 The fixture from 1.1, replayed through `translateClaudeStream`,
  yields the expected sequence of update kinds and titles.
- [x] 5.2 Every translated update is typed as the ACP SDK's own
  `SessionUpdate`, so the compiler checks its shape against ACP's
  generated schema. The SDK's zod schemas are not reachable through its
  package exports, so a runtime check against `zSessionUpdate` was not
  available.
- [x] 5.3 A line carrying only an unknown block type is forwarded
  unchanged and the run still ends as its `result` line says.
- [x] 5.4 The existing `permission_denied` test passes unchanged; the
  test asserting `sessionUpdate === "assistant"` is rewritten to the new
  shape.
- [x] 5.5 The reader: one test per row of its table, including a failed
  update with no title and a plan with no entry in progress.
- [x] 5.6 The terminal prints a tool call's title, prints nothing for a
  completed update, and still breaks the line between prose and a tool
  call.
- [x] 5.7 The panel shows a tool call's title rather than
  `agent update: tool_call`.
- [x] 5.8 The output channel shows a tool call as `[agent] <title>` and a
  text chunk as its text.

## 6. Verification

- [x] 6.1 This change validates strictly. `check(validate-change)`
- [x] 6.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
  2026-09-13, exit 0: typecheck in all five packages; English, source
  text, changesets, screenshots (22 of 22 captured) and test budgets
  passed. Tests: cli 126 (12 files), core 1160 (82), extension 327 (24),
  server 84 (4), webui 395 (43). The first run failed the test-budget
  check — `claude-acp.test.ts` now reads a fixture and stated no budget —
  and passed once it stated one.
- [x] 6.3 A pending changeset exists. `check(changeset-present)`
  `.changeset/an-agent-update-says-something.md`.
- [ ] 6.4 **Delegated to `claude-cli`**: run a real change with
  `claude-cli-acp` from the terminal and from the standalone AI panel.
  Evidence: the terminal output and a picture of the panel. Unit tests
  replay a captured stream; only a live run shows what a person watching
  actually reads.
