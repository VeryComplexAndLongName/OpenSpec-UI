From a tester's feedback on 2026-10-07 (point 5 of the reply). ADR 0041.

## 1. Core

- [x] 1.1 `protocol.ts`: command kind `update`; every adapter maps it as it
  maps `plan` (design.md decision 1). Tests: each adapter builds an
  invocation for it under the default allowlist.
  `update` in `CommandKind` and `COMMAND_KINDS`. No adapter maps kinds to
  invocations: each builds the same invocation for every kind and puts
  `commandInstruction(kind)` before the prompt, so `update` needs no
  mapping; the server's `isCommandLike` test covers every kind in
  `COMMAND_KINDS` and an `update` with notes. Also in `command-purpose.ts`,
  `agent-status.ts` and `live-runs.ts`.
- [x] 1.2 `agents/shared.ts`: the update instruction; the review
  instruction's verdict line (decisions 2 and 4). Tests beside the
  existing instruction tests.
  `shared.test.ts`: 24 passed.
- [x] 1.3 `security.ts`: the sections "The last review" and "The
  operator's notes" for an `update` prompt (decision 3). Tests: a change
  with a review, one without, a note.
  Read by `last-review.ts` from every worktree's audit log;
  `last-review.test.ts` (2) and three cases in `security.test.ts`.
- [x] 1.4 `review-verdict.ts`: the marker reader; `agent-runner.ts` puts
  `reviewVerdict` on the terminal event and the audit entry. Tests: forms
  with list marks and emphasis, prose not read, the last one winning.
  `review-verdict.test.ts`; `agent-runner.test.ts` 33 passed, including a
  review that prints its findings and reports no summary (design.md
  decision 7).
- [x] 1.5 `harness-chain-runner.ts`, `harness-step-agent.ts`,
  `harness-config.ts`: the update after a review that asks for one;
  `stepAgents.update` (decision 5). Tests in the chain runner's tests:
  changes needed, ready, no verdict, `stepAgents.update` honoured.
  `harness-chain-runner.ts` only: `stepAgents.update` was left out, the
  review's agent runs the update (decision 5 as revised). Three cases:
  changes needed runs plan, review, update, implement, verify; ready and
  no verdict skip the update; a failed update ends the chain before apply.

## 2. Surfaces

- [x] 2.1 `packages/webui`: `update` in the AI panel with notes and the
  review's date; **Update the plan** on the card (decision 6). Tests.
  Notes field whose label says it reads the last completed review, in
  place of the review's date (decision 6 as revised); the card's button
  where the last run was a review that said `changes needed`
  (`last-runs.ts` carries `reviewVerdict`). `AiPanel.test.tsx`,
  `PipelineView.test.tsx`, `extension-context.test.ts`, `last-runs.test.ts`.
- [x] 2.2 `packages/extension` and `packages/server`: the command reaches
  the runner in both hosts. Tests.
  Extension: the board's button opens the AI panel on `update`
  (`pipeline-panel.test.ts`); server: `wire.test.ts`.
- [x] 2.3 `packages/cli`: `openspec-ui-cli update`. Tests.
  `update-plan.test.ts` (5, including a permission request answered at the
  terminal and denied where nobody can be asked) and `main.test.ts`.

## 3. Documents

- [x] 3.1 `docs/adr/0041-the-plan-is-updated-from-its-review.md` accepted;
  `docs/adr/README.md` row.
- [x] 3.2 `HARNESS.md`: the update, the verdict, `stepAgents.update`.
  "A review that asks for changes", under the stage sequence; the review
  row of the table. No `stepAgents.update` to describe.
- [x] 3.3 A changeset: core, webui, server, cli, extension, minor.
  `.changeset/the-plan-is-updated-from-its-review.md`.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
  Typecheck clean; lint 0 errors (3 warnings in lines this change did not
  touch); seven script tests and the English check pass. Core 2160,
  core-git-subprocess 70, cli 207, webui 722, server 122, extension 509
  passed.
- [x] 4.2 `openspec validate the-plan-is-updated-from-its-review --strict`,
  and the merge gate with the worktree's absolute path as `--cwd`.
  Valid; the gate with the worktree's absolute path reports only 4.4 open
  (Human-only).
- [x] 4.3 One live run: a review that asks for changes, then `update`;
  record what the review found and what the update changed.
  2026-10-07, a scratch repository with a change `add-greeting` whose
  task 1.1 contradicted its spec (`Hi <name>` in upper case against
  `Hello, <name>!`) and whose task 1.2 published to npm. The review
  (`copilot-cli-acp`) found both and ended `Review verdict: changes
  needed`; the audit entry carried the verdict and the findings. The
  update ran through the CLI's `updatePlan` on the same agent with the
  note "Publishing is out of scope for this change; drop it.", every
  permission request allowed as an operator would: it asked three times,
  rewrote 1.1 to `Hello, <name>!` with the spec's scenario as its check,
  removed 1.2, left proposal and spec as they were and said why, and
  `openspec validate add-greeting --strict` passed. The earlier attempts
  found what design.md decision 7 fixes. They also found that
  `copilot-cli` on Windows loses everything after the prompt's first line,
  `--allow-all-tools` included, through the `copilot.cmd` shim - a fault
  of that adapter for every command, left to a change of its own.
- [x] 4.4 **Human-only**: in either host, after a review that asks for
  changes, update the plan from the card, and see the review's findings
  answered in the artifacts.
  Closed by VeryComplexAndLongName@gmail.com on 2026-10-07: Human confirmed everything works as expected
