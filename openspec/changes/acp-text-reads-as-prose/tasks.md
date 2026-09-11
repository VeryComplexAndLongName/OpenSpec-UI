A buffer that knows two event kinds and not the third. ACP agents emit
`agentUpdate`, not `stdout`, so every slice of a streamed reply renders
as its own element.

## 1. Reading an update

- [x] 1.1 A browser-safe leaf module in `packages/core/src`: given an
  `agentUpdate`'s payload, answer whether it carries streamed text and
  what that text is. No Node imports —
  `packages/server/src/static.test.ts` is the gate.
  `packages/core/src/acp-streamed-text.ts`, `readAcpStreamedText`.
- [x] 1.2 It recognises the `sessionUpdate` kinds that carry text, and
  reports the kind alongside the text so two updates of different kinds
  are never joined. `ACP_TEXT_CHUNK_KINDS` — `agent_message_chunk` and
  `agent_thought_chunk`, and the reader returns `{ kind, text }`.
- [x] 1.3 An update whose shape it does not recognise carries no text.
  ACP is not ours and the payload is passed through verbatim; guessing
  turns a protocol addition into mangled output. An unrecognised
  `sessionUpdate` reads as no text, and so does a content block whose
  `type` is not `"text"` — a `resource_link`'s filename is not prose.
- [x] 1.4 Exported through `browser.ts`. Also through `index.ts`, as
  every other leaf module of this shape is.

## 2. Joining

- [x] 2.1 `collapseStreamEvents` in
  `packages/webui/src/components/AiPanel.tsx` folds consecutive
  `agentUpdate` events that carry text of the same kind into one.
- [x] 2.2 The text concatenates with nothing between the pieces, as
  `stdout` does and unlike `stderr` and `progress`. A chunk is a slice
  of a sentence, not a line, and a separator would break a word.
- [x] 2.3 The folded event keeps the shape of the first, with only its
  text extended, so anything else the payload carries is preserved. The
  rewrite goes through the same core module (`withAcpStreamedText`), so
  the panel never has to know where in the payload the text sits — and
  it returns a new payload object rather than mutating the caller's,
  which the shallow copy `collapseStreamEvents` already makes would not
  have covered.
- [x] 2.4 Any other update breaks the run and is left alone.

## 3. Tests

- [x] 3.1 Core: text read from a message chunk, from a thought chunk,
  and absent from a tool-call update, a usage update and an update of
  an unfamiliar shape. `packages/core/src/acp-streamed-text.test.ts`,
  10 tests.
- [x] 3.2 Webui: a run of message chunks splitting a word across two
  events folds into one event whose text has no break in the word.
- [x] 3.3 Webui: message chunks and thought chunks do not fold into
  each other.
- [x] 3.4 Webui: a tool-call update between two message chunks leaves
  three events, in order.
- [x] 3.5 Webui: `stdout`, `stderr` and `progress` folding is
  unchanged — assert it, because this edits the function they share.
  3.2-3.5 are the two `collapseStreamEvents` describes at the end of
  `packages/webui/src/components/AiPanel.test.tsx`, 10 tests.

## 4. Verification

- [x] 4.1 `openspec validate --strict --changes`. Run 2026-09-11, exit
  0: `✓ change/acp-text-reads-as-prose`, 1 passed, 0 failed.
- [x] 4.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run. Run 2026-09-11, exit 0 — typecheck, lint
  (english, source-text, changesets, test-budgets, per-package eslint)
  and test all green. Test counts: scripts under `node --test` —
  english 4, test-budgets 10, changesets 9; `@openspec-ui/cli` 48 tests
  in 4 files; `@openspec-ui/core` 963 tests in 68 files;
  `openspec-ui-vscode` 322 tests in 24 files; `@openspec-ui/server` 80
  tests in 4 files; `@openspec-ui/webui` 374 tests in 41 files.
- [x] 4.3 Whole browser suite, not only the specs this touches.
  `npm run test:browser --workspace @openspec-ui/server` run
  2026-09-11, exit 0: 14 passed in 2.9m, one worker, every spec —
  change-charts, harness-screenshots, lifecycle-concurrent-hosts,
  lifecycle-execution (3), lifecycle-recovery-and-rollback,
  scheduled-run (2), standalone, waiting-on-inbox (4). The
  harness-screenshots spec rewrote
  `docs/images/standalone/harness-settings.png` by 47 bytes — a
  re-encode of the same page, which this change does not touch. Left
  unstaged.
- [x] 4.4 Version bump via `npx changeset` for core and webui.
  `.changeset/acp-text-reads-as-prose.md`, minor for both.
- [x] 4.5 **Delegated to copilot-cli-acp**: run an agent over ACP for real
  and read the transcript, confirming a streamed reply appears as
  continuous prose rather than in slices. Evidence to record here: the
  agent used, and the transcript's shape before and after — a count of
  rendered elements for one reply, or the text itself. The unit tests
  cover the folding rule; only a live stream shows whether the rule
  matches what an agent actually sends.

  Retargeted from `claude-cli` to `copilot-cli-acp` for a reason worth
  keeping: `claude-cli-acp` does not speak real ACP. It synthesises
  `sessionUpdate` from Claude's stream-json `type`, so its updates read
  `assistant` and `result`, never `agent_message_chunk`, and nothing
  here folds them. That is correct under 1.3 rather than a gap — and
  without `--include-partial-messages` it emits one update per whole
  message anyway, so it has nothing to fragment. A live check against
  it would have shown the fix doing nothing and proved the opposite of
  what it set out to.

  Run 2026-09-11 against a throwaway workspace, one `status` command,
  the smallest spend that answers the question. The agent replied with
  **168** `agentUpdate` events:

      available_commands_update 1, session_info_update 1,
      config_option_update 1, usage_update 2, tool_call 3,
      tool_call_update 3, agent_thought_chunk 72,
      agent_message_chunk 85

  157 of them read as text. Folded: **168 elements before, 14 after**.

  The folded text reads as written — one thought, then two messages,
  with the tool calls between them intact and the thinking kept apart
  from the speech:

      FOLDED [agent_message_chunk]: "I'll inspect the change directory
      and its task state, then report what is currently implemented."

  Eighty-five slices for one short reply is what "half a word on the
  screen" was.
