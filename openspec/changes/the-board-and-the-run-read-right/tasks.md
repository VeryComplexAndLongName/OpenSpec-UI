From a tester's feedback on 2026-10-07 (points 1 to 3 of the reply).

## 1. The board

- [ ] 1.1 `security.ts`: `AuditEntry.command`; `agent-runner.ts` records it
  on a run's started and terminal entries (design.md decision 1).
- [ ] 1.2 `audit-runs.ts`: `isWorkEntry`, `workTimestampsByChange`;
  `change-stages.ts` reads In progress from them (decision 2). Tests in
  `audit-runs.test.ts` (each kind of entry, and the times the board gets)
  and `change-stages.test.ts` (propose and review leave a change Planned,
  implement moves it on).

## 2. The run

- [ ] 2.1 `AiPanel.tsx`: the status line, the Result section rendered as
  Markdown, the run analysis without the result and with the tool calls,
  the log without the result (decisions 3 and 5). Tests in
  `AiPanel.test.tsx`.
- [ ] 2.2 `AiPanel.tsx`, `HarnessChainPanel.tsx`, `shell-ui.ts`: the log as
  text, the agent's words as Markdown, tool calls as quiet lines, no frames
  (decision 4).

## 3. Documents

- [ ] 3.1 A changeset: core, webui, server, extension, patch.

## 4. Checks

- [ ] 4.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
- [ ] 4.2 `openspec validate the-board-and-the-run-read-right --strict`,
  and the merge gate with the worktree's absolute path as `--cwd`.
- [ ] 4.3 **Human-only**: run a review on a change in the AI panel and see
  the result once, rendered, and the log without frames; run propose and
  review on a planned change and see its card stay Planned.
