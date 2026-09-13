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
- [x] 4.6 An update a person can read nothing in is left out of the AI
  panel's log, the chain panel's log and the output channel, instead of
  being named by its kind. Added after the live run in 6.4 showed the
  panel full of `agent update: system` lines; see `design.md`, "What the
  live run showed". The filter is `isShownInEventLog`, applied where a log
  is drawn.

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
- [x] 5.9 The panel's log and the output channel show nothing for a tool
  call with no title, a `system` line, a `rate_limit_event`, a completed
  call and a usage figure; a `Glob` given an absolute pattern inside the
  run's directory is titled relative to it.

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
  Run again after the two fixes 6.4 found, exit 0, every check above
  passing: cli 126, core 1160, extension 327, server 84, webui 396 — the
  one more is the chain panel's log test.
- [x] 6.3 A pending changeset exists. `check(changeset-present)`
  `.changeset/an-agent-update-says-something.md`.
- [x] 6.4 **Delegated to `claude-cli`** — *performed by the agent that
  wrote the code, and closed on the owner's instruction. Recorded rather
  than glossed: the marking rule calls a self-close a rubber stamp, and
  the argument for closing it anyway is that this run found two real
  defects and changed the code, which a stamp does not.*
  Run a real change with
  `claude-cli-acp` from the terminal and from the standalone AI panel.
  Evidence: the terminal output and a picture of the panel. Unit tests
  replay a captured stream; only a live run shows what a person watching
  actually reads.

  2026-09-13, in a throwaway repository (`git init`, `openspec init`, one
  change `say-hello`: create `hello.txt`, read it back) so this
  repository was never touched. Real `claude` 2.1.237, the worktree's own
  CLI and server sources, no mocks. Paths below are shortened; they named
  the account.

  **Terminal**, `openspec-ui-cli run say-hello`, every agent stage on
  `claude-cli-acp` with `claude-haiku-4-5-20251001`: exit 0, apply $0.03
  and verify $0.04 in the audit log, the change archived, `hello.txt`
  containing `hello`. What it printed, trimmed where haiku's thinking ran
  on:

  ```
  ▶ apply — claude-cli-acp
  The user wants me to implement the tasks from tasks.md ...
  · Write hello.txt
  · Read hello.txt
  Done! Both tasks completed: ...
  · reported $0.03, 693 tokens
  ✓ apply → verify

  ▶ verify — claude-cli-acp
  · Read openspec/changes/say-hello/tasks.md
  · Glob <repository>/openspec/changes/say-hello/specs/*/spec.md
  · Read hello.txt
  · Edit openspec/changes/say-hello/tasks.md
  ✅ Both tasks verified and checked. ...
  · reported $0.04, 1,491 tokens
  ✓ verify → archive

  ▶ archive
  ✓ archived say-hello
  ```

  Haiku sends its thinking with text, unlike sonnet in the fixture, and
  it is printed as prose, as ACP's `agent_thought_chunk` is.

  **Defect 1, found here.** That `Glob` was given an absolute pattern and
  printed it whole — the account name in a line meant to be read at a
  glance. A pattern is now shown relative to the run's directory, as a
  path already was; the titles test covers it.

  **Standalone panel**, the real server over the same repository, driven
  in Chromium: `review` with `claude-cli-acp`, default model, completed,
  $0.20. The log read:

  ```
  started (review)
  agent update: system
  agent update: rate_limit_event
  agent update: system
  agent update: system
  Bash: ls -la "<repository>/openspec/changes/say-hello" ...
  agent update: system
  agent update: tool_progress
  agent update: system
  agent update: tool_call_update
  ...
  ```

  **Defect 2, found here.** Tool calls were finally named, and drowned:
  Claude's own `system`, `rate_limit_event` and `tool_progress` lines
  were named by their kind, and every completed call added
  `agent update: tool_call_update` — noise this change had itself made,
  since a completed call reads as nothing. Task 4.6 and 5.9 came from
  this: an update a person can read nothing in is left out of both
  panels' logs and the output channel.

  Run again after the fix — and after rebuilding the server's client
  bundle, without which the first re-run still served the old panel and
  looked unfixed: `review` completed, $0.14, and the log read:

  ```
  started (review)
  Bash: cd "<repository>" && ls -la && ... find openspec/changes/say-hello -type f
  Bash: cd "<repository>" && find openspec -maxdepth 2 -type f
  Bash: cd "<repository>" && for f in openspec/config.yaml ...; do ... cat "$f"; done
  Bash: cd "<repository>" && find .openspec-ui -type f && ... ls hello.txt
  failed: Bash: cd "<repository>" && find .openspec-ui -type f && ... ls hello.txt
  Reviewed all artifacts in `openspec/changes/say-hello` ...
  usage: 8 in, 2 199 out, 113 302 cached, $0.14
  completed: Reviewed all artifacts ...
  ```

  No line named only by its kind. The failure is real: `hello.txt` did
  not exist yet, which the review then says. The pictures of both panel
  runs were looked at and are not committed: they show the scratch path,
  which names the account.
