From the owner's run of `HppMCP`'s `mcp-platform-foundation` on 2026-10-10,
refused as outside the workspace.

## 1. Core

- [x] 1.1 `run-root.ts`: `runRootOf` and `agentsByRunRoot`. Tests.
  `run-root.test.ts`, 3 tests (2026-10-10).
- [x] 1.2 The chain runner asks for a stage's agent with its `cwd`.
  `harness-chain-runner.ts`; its tests pass (2026-10-10).

## 2. Hosts

- [x] 2.1 The editor: the chain, the AI panel's single stages and a card's
  controls of a run take the agents of the run's directory; the worktrees'
  container is read at activation.
  `extension.ts`, `ai-panel.ts`, `pipeline-run-control.ts`; their tests
  expect the run's directory beside the agent; all of the extension's unit
  tests pass (2026-10-10).
- [x] 2.2 The editor's run dialog reads and writes the change's harness
  where the change is worked.
  `commands.ts`, `createRunChoiceHandler` (2026-10-10).
- [x] 2.3 The standalone server: the chain and the socket's single stages
  take the agents of the run's directory.
  `server.ts`, `websocket.ts`; `server.test.ts` 110 pass (2026-10-10).

## 3. Documents

- [x] 3.1 A changeset: core minor, extension and server patch.

## 4. Checks

- [x] 4.1 `npm run typecheck && npm run lint`, with the affected tests.
  2026-10-10: typecheck clean; lint 0 errors (4 warnings, none in files
  this change touched). Core run-root and chain runner; the extension's
  unit tests; the server's 110 - with two workers.
- [x] 4.2 `openspec validate a-change-runs-in-its-own-worktree --strict`,
  and the merge gate with the worktree's absolute path as `--cwd`.
  2026-10-10: valid under `--strict`; the gate named only 4.1, 4.2 and 4.3
  as open.
- [x] 4.3 **Human-only**: in `HppMCP`, on the extension built from this
  branch, Run Change... on the card of a change in its own worktree runs
  its stages without "outside the workspace".
  2026-10-10, the owner, on the extension 0.103.0 built from this branch:
  the change started and is working ("The change started and is working").
