From a tester's feedback on 2026-10-07 (point 5 of the reply). ADR 0041.

## 1. Core

- [ ] 1.1 `protocol.ts`: command kind `update`; every adapter maps it as it
  maps `plan` (design.md decision 1). Tests: each adapter builds an
  invocation for it under the default allowlist.
- [ ] 1.2 `agents/shared.ts`: the update instruction; the review
  instruction's verdict line (decisions 2 and 4). Tests beside the
  existing instruction tests.
- [ ] 1.3 `security.ts`: the sections "The last review" and "The
  operator's notes" for an `update` prompt (decision 3). Tests: a change
  with a review, one without, a note.
- [ ] 1.4 `review-verdict.ts`: the marker reader; `agent-runner.ts` puts
  `reviewVerdict` on the terminal event and the audit entry. Tests: forms
  with list marks and emphasis, prose not read, the last one winning.
- [ ] 1.5 `harness-chain-runner.ts`, `harness-step-agent.ts`,
  `harness-config.ts`: the update after a review that asks for one;
  `stepAgents.update` (decision 5). Tests in the chain runner's tests:
  changes needed, ready, no verdict, `stepAgents.update` honoured.

## 2. Surfaces

- [ ] 2.1 `packages/webui`: `update` in the AI panel with notes and the
  review's date; **Update the plan** on the card (decision 6). Tests.
- [ ] 2.2 `packages/extension` and `packages/server`: the command reaches
  the runner in both hosts. Tests.
- [ ] 2.3 `packages/cli`: `openspec-ui-cli update`. Tests.

## 3. Documents

- [ ] 3.1 `docs/adr/0041-the-plan-is-updated-from-its-review.md` accepted;
  `docs/adr/README.md` row.
- [ ] 3.2 `HARNESS.md`: the update, the verdict, `stepAgents.update`.
- [ ] 3.3 A changeset: core, webui, server, cli, extension, minor.

## 4. Checks

- [ ] 4.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
- [ ] 4.2 `openspec validate the-plan-is-updated-from-its-review --strict`,
  and the merge gate with the worktree's absolute path as `--cwd`.
- [ ] 4.3 One live run: a review that asks for changes, then `update` from
  the panel; record what the review found and what the update changed.
- [ ] 4.4 **Human-only**: in either host, after a review that asks for
  changes, update the plan from the card, and see the review's findings
  answered in the artifacts.
