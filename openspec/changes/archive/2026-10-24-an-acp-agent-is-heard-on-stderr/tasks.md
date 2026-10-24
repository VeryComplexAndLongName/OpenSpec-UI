From the review of the Codex integration on 2026-10-24: the ACP driver left
every agent's stderr unread.

## 1. Driver

- [x] 1.1 `acp-session-driver.ts`: `AcpStderr` drains the agent's stderr
  from spawn, keeps its last 4000 characters; `runProcess` hands the chunks
  on as `stderr` events before each run event and at its end, and ends a
  failure's reason with the tail (`withStderrTail`).
- [x] 1.2 Tests: a fake agent that writes to stderr and closes its
  connection - the chunk as a `stderr` event, the tail in the failure; the
  tail kept short while every chunk is handed on.
  `acp-session-driver.test.ts`, 2 new; with the four ACP adapters' tests,
  48 pass (2026-10-24).

## 2. Documents

- [x] 2.1 A changeset for core (patch).

## 3. Checks

- [x] 3.1 `npm run typecheck && npm run lint`; the ACP tests with two
  workers.
  2026-10-24: typecheck clean; lint 0 errors (4 warnings, none in files
  this change touched); the ACP driver's and adapters' 48 tests pass.
- [x] 3.2 `openspec validate an-acp-agent-is-heard-on-stderr --strict`, and
  the merge gate with the worktree's absolute path as `--cwd`.
  2026-10-24: valid under `--strict`; the gate named only 3.1 and 3.2 as
  open.
