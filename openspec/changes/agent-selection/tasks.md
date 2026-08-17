## 1. Core: browser-safe default agent id

- [x] 1.1 Move `DEFAULT_AGENT_ID = "claude-cli"` from
  `packages/core/src/default-runners.ts` into
  `packages/core/src/agents/registry.ts`; have `default-runners.ts`
  import it from there instead of redeclaring it.
- [x] 1.2 Re-export `DEFAULT_AGENT_ID` from `packages/core/src/browser.ts`
  alongside `AGENT_REGISTRY`.
- [x] 1.3 Update `registry.test.ts`/`default-runners.test.ts` as needed to
  cover the moved constant (same value, same behavior, just relocated).
  No test changes were needed — `default-runners.test.ts` already imports
  `DEFAULT_AGENT_ID` from `./default-runners.js`, which still re-exports
  it; both test files pass unmodified.

## 2. Wire real agent runners into the three entry points

- [x] 2.1 `packages/server/src/cli.ts`: pass
  `runners: buildDefaultAgentRunners({ workspaceRoot, allowExternalCwd })`
  into `createServer(...)`.
- [x] 2.2 `packages/server/src/optional-server.ts`:
  `OptionalServerManager.start()` passes the same
  `runners: buildDefaultAgentRunners({ workspaceRoot: this.workspaceRoot })`
  into its `createServer(...)` call.
- [x] 2.3 `packages/extension/src/extension.ts`: build
  `const runners = buildDefaultAgentRunners({ workspaceRoot })` once at
  activation (workspace root already resolved there); change the
  `AiPanel` deps' `resolveRunner` from `() => undefined` to
  `(agentId) => resolveRunner(runners, agentId)`.
- [x] 2.4 Add/extend tests: `server.test.ts` (a real `implement`/`plan`
  run resolves through a runner instead of 400ing with unknown agentId —
  can use a fake `AgentRunner` the way `server.test.ts` already does for
  the WebSocket contract test), `optional-server.test.ts` (runners option
  is passed through), extension `commands.test.ts`/a new assertion that
  `resolveRunner` deps is no longer the constant-`undefined` function.
  `server.test.ts` already had full coverage of the resolveRunner/agentId
  contract via WebSocket (including the "unknown agentId" failure path)
  using a fake runner map — nothing new needed there, this change only
  touches how `cli.ts` constructs that map, not the resolution logic
  itself. Added a `runners: expect.any(Map)` + key-presence assertion to
  `optional-server.test.ts`. For the extension, found and fixed a real,
  pre-existing test that encoded the exact gap this change closes:
  `src/test/suite/extension.test.ts`'s
  `"runners are not required in direct OpenSpec mode"` asserted
  `runners === undefined || runners.size === 0`; replaced with an
  assertion that all five registered agent ids are present. Verified for
  real against a live `@vscode/test-electron` instance already available
  in this environment (see `smoke-test-notes.md`) — all 6 integration
  tests pass.

## 3. AiPanel: expose plan/implement/review and the agent picker

- [x] 3.1 Add `"plan"`, `"implement"`, `"review"` to
  `RUNNABLE_COMMANDS` and `CHANGE_REQUIRED_COMMANDS` in
  `packages/webui/src/components/AiPanel.tsx`.
- [x] 3.2 Add `agentId` state (default `DEFAULT_AGENT_ID`, imported from
  `@openspec-ui/core/browser`) and an agent `<select>` populated from
  `AGENT_REGISTRY`, next to the existing command picker.
- [x] 3.3 Include `agentId` in the `Command` object built by `runCommand`.
  Only set for `plan`/`implement`/`review` (`AGENT_COMMANDS`); `undefined`
  for the four direct commands, which do not use a runner at all.
- [x] 3.4 Add `AiPanel.test.tsx` cases: the agent picker defaults to
  `DEFAULT_AGENT_ID`; selecting a different agent and running "implement"
  sends a `Command` with that `agentId`; `plan`/`implement`/`review`
  require a selected change the same way `status`/`show`/`validate`
  already do.
  Also added a picker-disabled-for-direct-commands assertion and an
  agentId-omitted-for-direct-commands assertion, beyond what was listed.
  Updated the pre-existing "shows direct OpenSpec commands in command
  picker" test, which asserted exactly 4 options — now 7.

## 4. Documentation

- [x] 4.1 `README.md`: document the agent-selection mechanism — what it
  is, that each CLI tool must already be installed and authenticated
  separately, and how it differs from VS Code's native Chat/Agent mode
  (which is untouched and uses VS Code's own model picker instead).
  Added a new "Agent Selection" section plus a Delivery Capability Matrix
  row.
- [x] 4.2 `packages/server/README.md`: note that `runners` is now
  populated by default via `buildDefaultAgentRunners` in the shipped
  `cli.ts`/`optional-server.ts`, not left empty.
- [x] 4.3 `packages/extension/README.md` (create if it does not exist, or
  extend `packages/extension/readme.md` — check which file actually ships
  in the `.vsix`, see `changelog.md`'s sibling) — same note for the
  message-bridge and optional-local-server modes.
  Confirmed `README.md` (capital, same file referenced as `readme.md` in
  the packaged `.vsix` listing) is the one file — extended it with a
  Features bullet and a new "Agents" section.

## 5. Verification, versioning, and smoke test

- [x] 5.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/core`, `packages/server`, `packages/webui`,
  `packages/extension`.
- [x] 5.2 Bump `package.json` versions (minor) for all four touched
  packages per `openspec/config.yaml`.
  core 0.12.0 → 0.13.0, server 1.3.0 → 1.4.0, webui 1.4.0 → 1.5.0,
  extension 0.6.0 → 0.7.0.
- [x] 5.3 Manual smoke test: run a real `status` (already-supported
  baseline) and, if a CLI agent is actually available in this
  environment, a real `implement`/`plan` through the new picker in
  standalone; otherwise verify the `failed` event path with a
  deliberately-missing agent id/tool and record which parts could not be
  exercised end to end in this environment, per the established
  `smoke-test-notes.md` format from the prior two changes.
  Both `claude` and `copilot` CLIs are actually installed in this
  environment — ran a real `plan` through `claude-cli` (read-only command,
  safe to execute for real) end to end, plus the negative `codex-cli`
  (not installed) path to prove the wiring itself, not just tool
  availability. See `smoke-test-notes.md` for full detail, including the
  one remaining gap (webview-level DOM interaction not separately
  driven).
- [x] 5.4 `openspec change validate --strict agent-selection` passes.
