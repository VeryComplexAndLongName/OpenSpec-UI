Found by the live check `the-operator-can-say-something-to-a-run` left
open, run against a throwaway workspace on 2026-09-20.

## 1. The terminal host takes what it is told

- [x] 1.1 `packages/cli/src/run-change.ts` passes
  `chainMessageHandlers` beside `chainStopRequestHandlers` to
  `withAgentStatus`.
- [x] 1.2 Its chain runner takes `chainAnswerWriter`, resolving the status
  directory only when an answer is due.
- [x] 1.3 `packages/cli/src/run-change.test.ts`'s chain fake carries
  `deliverMessage`, so the wiring is typed the way the host uses it.

## 2. An answer carries what was said

- [x] 2.1 `packages/core/src/harness-chain-runner.ts` remembers what a
  stage streamed - `stdout` chunks and ACP streamed text - bounded by
  `ANSWER_WORDS_LIMIT`, and answers with the tail where the stage has no
  closing summary.
- [x] 2.2 A stage that said nothing at all still answers that it said
  nothing: the wording is a fallback, not a default.
- [x] 2.3 `harness-chain-runner.test.ts` covers the tail being used where
  the stage has no summary.

## 3. Checks

- [x] 3.1 `npm run typecheck && npm run lint && npm run test`, run unpiped.
  Record each package's count.

  Done 2026-09-20: typecheck and lint green across the workspace. core 1622
  in 114 files plus 4 in 2 for the git subprocess project, cli 165 in 16,
  extension 454 in 32, server 109 in 4, webui 616 of 617 in 71 - the one
  failure is the known Windows-only
  `scripts/build-metro-icons.test.mjs` line-ending comparison, which fails
  here on an untouched tree and passes in CI.

  Seen once and not reproduced: `stop-boundary.test.ts`'s held-request test
  timed out while the whole core suite ran in parallel, and passed on its
  own. It waits on a 500 ms ticker, which a loaded machine can miss.
- [x] 3.2 A changeset: `@openspec-ui/core` patch, `@openspec-ui/cli` patch.
- [x] 3.3 A live check against a throwaway workspace: a note and a question
  left for a run started from the terminal, and the answer read back from
  the channel. Record what the answer carried.

  Done 2026-09-20 by Claude, at the owner's request, for the owner to look
  at in turn. The same throwaway repository the defects were found in,
  with both fixes in place:

  - the note and the question were taken by a run started with
    `openspec-ui-cli run say-hello`, which before this change took
    nothing, and the audit records both against the `verify` stage;
  - the answer written back carried the agent's own words, beginning
    "Verified both tasks against the repository state; no changes to
    `tasks.md` were needed", going on to account for each task by its
    bytes, and ending with what it made of the operator's note about
    British English. The fallback wording the first run produced is gone.
