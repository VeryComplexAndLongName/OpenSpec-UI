From a tester's feedback on 2026-10-07 (points 1 to 3 of the reply).

## 1. The board

- [x] 1.1 `security.ts`: `AuditEntry.command`; `agent-runner.ts` records it
  on a run's started and terminal entries (design.md decision 1).
  On both entries; `agent-runner.test.ts` passes with it.
- [x] 1.2 `audit-runs.ts`: `isWorkEntry`, `workTimestampsByChange`;
  `change-stages.ts` reads In progress from them (decision 2). Tests in
  `audit-runs.test.ts` (each kind of entry, and the times the board gets)
  and `change-stages.test.ts` (propose and review leave a change Planned,
  implement moves it on).
  `audit-runs.test.ts` (three cases) and `change-stages.test.ts` (one
  case): 20 passed.

## 2. The run

- [x] 2.1 `AiPanel.tsx`: the status line, the Result section rendered as
  Markdown, the run analysis without the result and with the tool calls,
  the log without the result (decisions 3 and 5). Tests in
  `AiPanel.test.tsx`.
  Three cases in `AiPanel.test.tsx`; 61 passed in the file.
- [x] 2.2 `AiPanel.tsx`, `HarnessChainPanel.tsx`, `shell-ui.ts`: the log as
  text, the agent's words as Markdown, tool calls as quiet lines, no frames
  (decision 4).
  `eventLogClass`; CSS scoped to the log, the VS Code font for the agent's
  words.

## 3. Documents

- [x] 3.1 A changeset: core, webui, server, extension, patch.
  `.changeset/the-board-and-the-run-read-right.md`.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`, and every test project, each
  on its own where the root run would exceed a background limit.
  Typecheck clean; lint 0 errors (3 warnings in lines this change did
  not touch); seven script tests pass. Core 2129, core-git-subprocess 70,
  cli 201, webui 717, server 122, extension 508 passed.
- [x] 4.2 `openspec validate the-board-and-the-run-read-right --strict`,
  and the merge gate with the worktree's absolute path as `--cwd`.
  Valid; the gate with the worktree's absolute path reports only 4.3
  open (Human-only).
- [ ] 4.3 **Human-only**: run a review on a change in the AI panel and see
  the result once, rendered, and the log without frames; run propose and
  review on a planned change and see its card stay Planned.
