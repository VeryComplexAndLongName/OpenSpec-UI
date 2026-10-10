## Why

The owner, on 2026-10-10, ran a change of `HppMCP` from its card, where
a-change-is-committed-where-it-is-made had just put Run Change...:

> stage started: apply (local-llm-acp)
> failed: cwd "C:/Prog/.worktrees/HppMCP/mcp-platform-foundation" is outside the workspace "c:\Prog\HppMCP"

A host binds its agents to one root, its workspace, and every agent's
sandbox refuses a run whose `cwd` is outside it. A change is made in a
worktree of its own (ADR 0043), under `<worktree root>/<repository>/`, which
is not inside the workspace. The chain, a single stage, and a card's
controls of a run all resolved their agent by its id alone, so every run in
a worktree was refused - in the editor and in the standalone app alike. The
CLI never met it: `openspec-ui-cli run change --cwd` builds its agents for
that directory. The run dialog's answers had the same blind spot: applying
a named configuration wrote the checkout's copy of the change's
`harness.json`, not the worktree's.

## What Changes

- A run inside one of the repository's worktrees is given that worktree's
  own agents, made once per worktree, whose sandbox is that worktree. Any
  other run gets the workspace's, whose sandbox still refuses a directory
  that is neither. `runRootOf` and `agentsByRunRoot` in core decide it.
- The chain runner asks for its agent with the stage's `cwd`; the editor's
  AI panel, its card controls and the standalone server's chain and socket
  runs do the same.
- The run dialog's answers in the editor read and write the change's
  harness where the change is worked.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-core`: a run in a change's own worktree runs on that
  worktree's agents.

## Impact

- `packages/core`: `run-root.ts` (new), `harness-chain-runner.ts`.
- `packages/extension`: `extension.ts`, `webview/ai-panel.ts`,
  `pipeline-run-control.ts`, `commands.ts` (the run dialog's answers).
- `packages/server`: `server.ts`, `websocket.ts`.
- A changeset: core minor (a new export), extension and server patch.
