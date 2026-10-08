From a tester's feedback on 2026-10-07 (point 6 of the reply), and the
owner's decisions the same day. ADR 0042. Depends on
the-plan-is-updated-from-its-review.

## 1. Core

- [x] 1.1 `agents/shared.ts`: the question instruction on every agent stage
  (design.md decision 1). Tests beside the instruction tests.
  `commandInstruction` in `agents/shared.ts` adds
  `OPERATOR_QUESTION_INSTRUCTION` to plan, implement, review, update and
  verify; `operator-question-instruction.test.ts` (2026-10-08).
- [x] 1.2 `operator-question.ts`: the marker reader. Tests: list and quote
  marks, emphasis, an empty question, the same one twice, prose not read.
  `readOperatorQuestion` and `LineCollector`; `operator-question.test.ts`
  covers list and quote marks, emphasis, an empty question and prose
  (2026-10-08).
- [x] 1.3 `protocol.ts`: the `question` event, the `answerQuestion`
  command; `agent-status.ts`: waiting kind `question` (decision 2). Tests.
  `question`, `awaitingAnswers`, `questionAnswered` events and the
  `answerQuestion` command in `protocol.ts`; waiting kind `question` in
  `agent-status.ts`; `protocol.test.ts`,
  `operator-question-instruction.test.ts` (2026-10-08).
- [x] 1.4 `decisions-file.ts`: append a question, answer one, read the open
  ones; the audit entries (decision 5). Tests: two runs' questions, an
  answer, a second answer refused.
  `decisions-file.ts` (`appendQuestion`, `answerQuestion`, `openQuestions`);
  audit entries carry `operatorQuestion`; `decisions-file.test.ts`: two
  runs' questions, an answer, a second answer refused (2026-10-08).
- [x] 1.5 `agent-runner.ts`: questions from the stream, the wait, the
  re-run with the answers (decision 3); the refusal past an open question
  (decision 6). Tests: a run that asks waits and does not complete; answers
  start the update with them in its prompt; a cancel ends the wait; a run
  on a change with an open question is refused; a read-only one is not.
  As built in `operator-questions-runner.ts`, a wrapper around every default
  runner, not inside `agent-runner.ts` (design.md decision 3);
  `operator-questions-runner.test.ts`: the run waits and does not complete,
  the answers start `update` with them in its prompt, a cancel ends the
  wait, a run past an open question is refused, a read-only one is not
  (2026-10-08).
- [x] 1.6 `agents/local-agent/tools.ts`, `agent-loop.ts`: `ask_operator`
  (decision 4). Tests: the loop blocks until answered and continues with
  the answer.
  `ask_operator` in `tools.ts`, `agent-loop.ts` (`askOperator`),
  `acp-agent.ts` (`waitForOperator`), `local-llm-acp.ts` (answer read from
  `decisions.md`); `agent-loop.test.ts`: the loop blocks until answered and
  continues with the answer (2026-10-08).
- [x] 1.7 `harness-chain-runner.ts`, `supervisor.ts`: the chain waits in the
  stage under every level; `act` leaves a waiting stage alone (decision 8).
  Tests in the chain runner's tests.
  `harness-chain-runner.ts` waits in the stage and leaves the wait out of
  the stage's time limit (test "does not cut a stage while it waits for the
  operator's answer"); `supervisor.ts` offers `answer` beside `status` and
  never a stop for a waiting run (`supervisor.test.ts`) (2026-10-08).

## 2. Surfaces

- [x] 2.1 `packages/webui`: questions with answer fields on the card and in
  the AI panel; the Inbox's questions (decision 7). Tests.
  Card **Answer...** form in `PipelineView.tsx` (questions from the survey's
  `openQuestions`), `OperatorQuestionsPrompt` in the AI and chain panels,
  the standalone Inbox's questions; `PipelineView.test.tsx`,
  `AiPanel.test.tsx` (2026-10-08).
- [x] 2.2 `packages/extension` and `packages/server`: `answerQuestion` in
  both hosts, and across hosts on the run's message channel. Tests.
  Extension: `answerQuestion` from the card and an inline **Answer This
  Question...** on the Inbox's question rows
  (`human-only-inbox-tree.test.ts`, `one-way-in.test.ts`); server:
  `answerQuestion` routed to the runner holding the run (`server.test.ts`
  "carries an answer to an agent's question to the runner that holds the
  run"). Across hosts the answer travels through `decisions.md`, which the
  waiting run reads (design.md decision 7) (2026-10-08).
- [x] 2.3 `packages/cli`: `answer`, and questions in `status`. Tests.
  `openspec-ui-cli answer` (`answer-command.test.ts`); `status` prints each
  waiting run's questions with the command that answers them
  (`status-command.test.ts`); `render-run.ts` renders the new events
  (2026-10-08).
- [x] 2.4 Found while checking 4.4 on 2026-10-08, and fixed:
  typing into the run panel's answer field blanked the panel (the updater
  read `e.currentTarget`, which React has cleared by then);
  copilot-cli-acp asks for several permissions at once, and the panels
  showed only the latest, so each Allow left another request's buttons in
  place; and a request the agent cancelled (`$/cancel_request`) or left
  open when its turn ended stayed on screen. The ACP driver now emits
  `permissionSettled` (outcome `withdrawn`) for both, and the panels show every pending
  request and drop one that was withdrawn or whose stage has ended. Tests:
  `AiPanel.test.tsx`, `HarnessChainPanel.test.tsx`,
  `acp-session-driver.test.ts` (a cancelled request, one left open).
  Then, on the second round: a question `local-llm-acp` waited on in its
  turn and the operator answered on the card stayed on the run panel,
  and after the run ended, because only the waiting path said
  `questionAnswered` in the run's stream. The wrapper now reads
  `decisions.md` while the agent works and says each of the run's
  questions answered there, whoever answered it, and the panels show no
  answer field once the run has ended. Tests:
  `operator-questions-runner.test.ts`, `AiPanel.test.tsx`,
  `operator-question-instruction.test.ts` (the tool instruction).
  Third round: a chain runs every stage under one run id, and each stage
  numbered its questions from 1, so the verify stage's question took the
  apply stage's id; the wrapper took it for answered and the chain ended,
  and the card offered an answer that could never be recorded. Ids now go
  on from those the run already has in `decisions.md`, an answer to an id
  the file holds twice goes to the open entry, and `ask_operator` waits on
  the latest question of its text. The card's answer form kept the
  questions it opened with; it now follows the card, adding a question
  asked since and dropping one answered elsewhere, and closes when none is
  left. Tests: `decisions-file.test.ts`, `operator-questions-runner.test.ts`,
  `PipelineView.test.tsx`.
  Fourth round: Allow given on the card left the run panel's buttons in
  place, since only an answer given in the panel itself took them away.
  The driver now says every answer in the run's stream as
  `permissionSettled` (outcome `allow` or `deny`), the event that also
  says a request was withdrawn, and the panels drop a settled request.
  Tests: `acp-session-driver.test.ts`, `AiPanel.test.tsx`.

## 3. Documents

- [x] 3.1 `docs/adr/0042-the-agent-asks-the-operator.md` accepted;
  `docs/adr/README.md` row.
  ADR 0042 Accepted, decisions 3 and 6 as built; row in `docs/adr/README.md`
  (2026-10-08).
- [x] 3.2 `HARNESS.md`: questions, `decisions.md`, the wait, the refusal.
  HARNESS.md "A question for the operator" and a row in "Find what you need"
  (2026-10-08).
- [x] 3.3 A changeset: core, webui, server, cli, extension, minor.
  `.changeset/the-agent-asks-the-operator.md`: core, webui, server, cli,
  extension, minor (2026-10-08).

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
  2026-10-08: typecheck clean; lint 0 errors (3 warnings, all in files and
  lines this change did not touch). Locally, the affected test files of each
  package with two workers: core 516 tests in 22 files, cli 65, extension
  82 + 22, webui 164, server 2 selected, all passing. The full projects,
  `core-git-subprocess` included, run in CI on the pull request.
- [x] 4.2 `openspec validate the-agent-asks-the-operator --strict`, and the
  merge gate with the worktree's absolute path as `--cwd`.
  2026-10-08, after rebasing onto origin/main: the change is valid under
  `--strict`; the gate names only 4.3 and 4.4 as still open.
- [x] 4.3 Live runs: a review on a CLI agent that asks a question, waits,
  and updates once answered; `local-llm-acp` asking through `ask_operator`
  mid-turn; record both.
  CLI agent, 2026-10-08, `copilot-cli-acp`, a scratch repository whose
  change left its storage backend undecided: the review printed
  `Question for the operator: Which storage backend should be used: SQLite
  ... or PostgreSQL ...?` 12 s in; `question Q-liverevi-1`, then
  `awaitingAnswers`, and the run did not complete. `decisions.md` held the
  question with `Answer: (open)`. An `implement` on the same change was
  refused meanwhile, naming the question and the three ways to answer. The
  answer, given from another process with `openspec-ui-cli answer demo
  Q-liverevi-1 "SQLite, a single file beside the app; no server."`, was
  read 2 s later (`questionAnswered`, by the git identity), the run went
  on as `update`, rewrote proposal, spec and tasks for SQLite and added
  design.md, and completed 77 s later. An earlier attempt on `claude-cli`
  failed before asking: that CLI is not signed in on this machine, and the
  failure said so.
  `local-llm-acp`, 2026-10-08, by the operator in VS Code, with
  Qwen3.6-35B-A3B-AWQ on choose-export-format (CSV or vCard undecided).
  A first run printed the marker line instead of calling its tool: the
  run waited, and went on as a second pass with the answer. Its
  instruction now tells it to ask with `ask_operator`, and the second run
  (`e6a70068`) called `ask_operator` twice in one turn, at 08:48:02 and,
  to confirm the first answer, at 08:48:23; each question went into
  `decisions.md` and on the card, the agent waited about 20 s and 4 min 40 s,
  and went on in the same turn with the answer as the tool's result,
  implemented both tasks and completed - no `awaitingAnswers`, no second
  pass.
- [ ] 4.4 **Human-only**: in either host, see a run stop on a question,
  answer it from the card, and see the run go on with the answer; see
  `apply` refused while a question is open.
