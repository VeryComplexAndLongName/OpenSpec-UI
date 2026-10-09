From ADR 0046, accepted by the owner on 2026-10-08.

## 1. Core

- [x] 1.1 `message-register.ts`: the groups, the entries of `CLI`, `RUN`,
  `QST` and `PRM`, `say` with values typed from the words,
  `formatMessage`, `withMessageCode`, `messageEntryUrl`,
  `renderMessagesPage`; exported from the root and the browser surface.
  46 identifiers: CLI 16, RUN 22, QST 6, PRM 2 (2026-10-09).
- [x] 1.2 `protocol.ts`: `code` on `progress`, `failed` and `cancelled`.
- [x] 1.3 The chain's refusals, limits and endings, the operator's
  questions and the autonomous permission request said from the register,
  with their words unchanged.
  `harness-chain-runner.ts`, `operator-questions-runner.ts`; the chain's
  and the question runner's 142 tests pass unchanged, and three assert the
  codes `OSW-RUN-104`, `OSW-QST-001` and `OSW-QST-201` (2026-10-09).
- [x] 1.4 `message-register.test.ts`: identifiers well formed, every one
  ever given kept, the page what the register says, values put in as
  given, and the ratchet. `npm run messages` writes the page.
  6 tests; the ratchet holds 290, from 323 on `main` (2026-10-09).

## 2. CLI

- [x] 2.1 The CLI's argument errors, the run's refusal and interruption
  lines, the answer's refusals and the permission nobody can answer said
  as `<level> OSW-...: <words>`.
  `main.ts`, `answer-command.ts`, `run-change.ts`, `stop-command.ts`,
  `task-command.ts`, `lease-command.ts`, `worktree-command.ts`,
  `update-plan.ts` (2026-10-09).
- [x] 2.2 `render-run.ts`: the identifier leads a failure's, a
  cancellation's and a progress line's words; the JSON carries `code`.
  Tests in `render-run.test.ts` and `main.test.ts`; all 218 of the CLI's
  tests pass (2026-10-09).

## 3. Hosts

- [x] 3.1 The output channel: `describe-event.ts` leads with the identifier,
  and a cancellation with a reason says it. Test in
  `describe-event.test.ts`.
- [x] 3.2 The panels: `MessageCode`, a label linking to the entry, before a
  failure's words in the Run and chain panels' status; the event lines
  lead with the identifier. Tests in `HarnessChainPanel.test.tsx`.

## 4. Documents

- [x] 4.1 `docs/messages.md`, generated.
- [x] 4.2 ADR 0046 amended: the hundreds, and the two ways a message reads.
  ADR 0044-0046 marked Accepted, in the files and the index.
- [x] 4.3 A changeset: core, cli, extension, webui - minor.

## 5. Checks

- [x] 5.1 `npm run typecheck && npm run lint`; the affected core, CLI,
  extension and webui tests, with two workers.
  2026-10-09: typecheck clean; lint 0 errors (3 warnings, none in files
  this change touched). Core: the register's 6, the chain's and the
  question runner's 142; CLI: all 218; extension: `describe-event`;
  webui: the Run and chain panels' 97. The full projects run in CI.
- [x] 5.2 `openspec validate every-message-has-an-identifier --strict`, and
  the merge gate with the worktree's absolute path as `--cwd`.
  2026-10-09: valid under `--strict`; the gate named only 5.1-5.3 as
  open before they were ticked.
- [ ] 5.3 **Human-only**: in VS Code, a run that fails for a registered
  reason shows `Failed:` with the identifier as a link, and the link opens
  its entry in `docs/messages.md`.
