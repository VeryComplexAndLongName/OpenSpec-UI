## Why

From a tester's feedback on 2026-10-07: an agent ended its run with four
decisions it needed from the operator, and the product offered no way to
answer them; a chain would have gone on to the next stage with them open.
The owner decided the same day: questions are caught, the run stops and
waits, nothing goes on without an answer, the answers are kept in the
change's `decisions.md` and in the audit log, and the product's own agent
asks in its turn from the start. ADR 0042 records the decision.

## What Changes

- Every agent stage's instruction asks for `Question for the operator: <…>`
  lines for decisions the agent needs; the product reads them as markers.
- `local-llm-acp` gets an `ask_operator` tool that blocks its turn until
  answered.
- A `question` event and an `answerQuestion` command; a `question` waiting
  kind in the run's status.
- A run that asked waits instead of completing, in a chain or alone, under
  every autonomy level; once answered, the stage runs again with the
  answers (`update` for propose and review, the same command otherwise).
- `openspec/changes/<change>/decisions.md` holds every question and answer;
  the audit log records both; an agent run on a change with an open
  question is refused.
- Questions are answered from the card, the AI panel, the Human-Only Inbox
  and `openspec-ui-cli answer`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-core`: the marker, the event and command, `decisions.md`, the
  refusal of a run past an open question.
- `acp-agent-adapters`: `ask_operator` in `local-llm-acp`.
- `agentic-harness`: a chain waits on a question, and re-runs the stage
  once answered.
- `shared-ui`: open questions and their answer fields on the card and in
  the panel; the Inbox's questions.
- `ci-cli`: `openspec-ui-cli answer`, and questions in `status`.

## Impact

- `packages/core`: `protocol.ts`, `agents/shared.ts`,
  `operator-question.ts` (new: marker reader), `decisions-file.ts` (new),
  `agent-runner.ts`, `agent-status.ts`, `harness-chain-runner.ts`,
  `agents/local-agent/tools.ts` and `agent-loop.ts`, the Human-Only Inbox
  reader, `supervisor.ts`.
- `packages/webui`, `packages/extension`, `packages/server`, `packages/cli`.
- `docs/adr/0042-the-agent-asks-the-operator.md`, `HARNESS.md`.
- Depends on `the-plan-is-updated-from-its-review` for `update`.
