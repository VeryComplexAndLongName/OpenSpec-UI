From a tester's feedback on 2026-10-07 (point 6 of the reply), and the
owner's decisions the same day. ADR 0042. Depends on
the-plan-is-updated-from-its-review.

## 1. Core

- [ ] 1.1 `agents/shared.ts`: the question instruction on every agent stage
  (design.md decision 1). Tests beside the instruction tests.
- [ ] 1.2 `operator-question.ts`: the marker reader. Tests: list and quote
  marks, emphasis, an empty question, the same one twice, prose not read.
- [ ] 1.3 `protocol.ts`: the `question` event, the `answerQuestion`
  command; `agent-status.ts`: waiting kind `question` (decision 2). Tests.
- [ ] 1.4 `decisions-file.ts`: append a question, answer one, read the open
  ones; the audit entries (decision 5). Tests: two runs' questions, an
  answer, a second answer refused.
- [ ] 1.5 `agent-runner.ts`: questions from the stream, the wait, the
  re-run with the answers (decision 3); the refusal past an open question
  (decision 6). Tests: a run that asks waits and does not complete; answers
  start the update with them in its prompt; a cancel ends the wait; a run
  on a change with an open question is refused; a read-only one is not.
- [ ] 1.6 `agents/local-agent/tools.ts`, `agent-loop.ts`: `ask_operator`
  (decision 4). Tests: the loop blocks until answered and continues with
  the answer.
- [ ] 1.7 `harness-chain-runner.ts`, `supervisor.ts`: the chain waits in the
  stage under every level; `act` leaves a waiting stage alone (decision 8).
  Tests in the chain runner's tests.

## 2. Surfaces

- [ ] 2.1 `packages/webui`: questions with answer fields on the card and in
  the AI panel; the Inbox's questions (decision 7). Tests.
- [ ] 2.2 `packages/extension` and `packages/server`: `answerQuestion` in
  both hosts, and across hosts on the run's message channel. Tests.
- [ ] 2.3 `packages/cli`: `answer`, and questions in `status`. Tests.

## 3. Documents

- [ ] 3.1 `docs/adr/0042-the-agent-asks-the-operator.md` accepted;
  `docs/adr/README.md` row.
- [ ] 3.2 `HARNESS.md`: questions, `decisions.md`, the wait, the refusal.
- [ ] 3.3 A changeset: core, webui, server, cli, extension, minor.

## 4. Checks

- [ ] 4.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
- [ ] 4.2 `openspec validate the-agent-asks-the-operator --strict`, and the
  merge gate with the worktree's absolute path as `--cwd`.
- [ ] 4.3 Live runs: a review on a CLI agent that asks a question, waits,
  and updates once answered; `local-llm-acp` asking through `ask_operator`
  mid-turn; record both.
- [ ] 4.4 **Human-only**: in either host, see a run stop on a question,
  answer it from the card, and see the run go on with the answer; see
  `apply` refused while a question is open.
