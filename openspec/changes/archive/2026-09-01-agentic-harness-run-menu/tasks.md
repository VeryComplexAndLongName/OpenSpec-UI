## 0. Gate

- [x] 0.1 Do not begin implementation until `agentic-harness-autonomy`'s
  `"chain"`/`"confirmCheckpoint"` protocol members and `HarnessChainPanel`
  component exist (this proposal/design/tasks may be written first).
  Satisfied — `agentic-harness-autonomy` at 25/26 (only its Extension Host
  smoke test remains, deferred by the user; the protocol/component this
  change depends on are implemented and tested).

## 1. Shared dispatch component

- [x] 1.1 The "which flow to open" decision is a pure function,
  `resolveRunWithHarnessTarget(config): "picker" | "chain"`
  (`packages/core/src/harness-dispatch.ts` — its own zero-Node-import leaf
  module, not `harness-config.ts` itself, so `@openspec-ui/core/browser`
  can re-export it as a real value without pulling `node:fs`/`node:path`
  into the browser bundle; caught live by `packages/server/src/
  static.test.ts` during implementation, fixed by extracting it). Actual
  shape differs from the originally proposed single shared React
  component: the extension host resolves `HarnessConfig` directly
  (Node-side `resolveHarnessConfig` import, no round trip) before ever
  revealing a panel, while the standalone shell resolves it over HTTP
  first (`packages/webui/src/run-with-harness-dispatch.ts`, wrapping the
  existing `harness-config-client.ts`) — both call this same pure
  function on the result, which is what "not duplicated per host" (design.md)
  actually required; a single React component could not span both hosts'
  genuinely different resolution mechanics.
- [x] 1.2 Unit tests: `harness-config.test.ts`'s `resolveRunWithHarnessTarget`
  describe block (3 tests: assisted/semi-autonomous/autonomous) and
  `run-with-harness-dispatch.test.ts` (5 tests, including a fresh HTTP
  resolve per call — no caching — and Windows-separator path handling).

## 2. VS Code integration

- [x] 2.1 `packages/extension/package.json`: new command
  `openspec-ui.runWithHarness` ("OpenSpec UI: Run with Agentic Harness"),
  context-menu entry on a change tree item (`viewItem ==
  openspec-ui.activeChange`) alongside `openspec-ui.configureHarnessForChange`.
  No `changes-tree.ts` change needed — context-menu contributions are
  pure `package.json` `when`-clause entries, same as the existing
  `configureHarnessForChange` entry.
- [x] 2.2 `packages/extension/src/commands.ts`: registers the command —
  resolves harness config fresh (Node-side `resolveHarnessConfig`), calls
  `resolveRunWithHarnessTarget`, reveals the AI panel with a new
  `startChain` context field. `AiPanelContext`/`getBridgeHtml`
  (`webview/ai-panel.ts`) carry it into the webview's initial HTML dataset
  (`data-start-chain`) — unlike `stepAgents`/`detectedAgents` (delivered
  as an async follow-up message), this must be known on the very first
  render since it decides which component mounts; also threaded through
  the follow-up context-message path (`extension-context.ts`'s
  `DashboardContext`, `extension-entry.tsx`) for the case where the
  webview panel is reused (already open) rather than freshly created.
  `extension-entry.tsx`'s `ExtensionApp` renders `HarnessChainPanel`
  instead of `AiPanel` when `startChain` is true, reset to `false` on
  every other reveal so a reused panel doesn't get stuck on the chain
  view.
- [x] 2.3 Real Extension Host smoke test — **verified 2026-09-01**: with `autonomyLevel: semi-autonomous` in a per-change `harness.json`, "Run with Agentic Harness" opened the chain panel (status `Idle`, `start-chain-button`) instead of the Agent Selection picker. Originally deferred
  alongside `agentic-harness-autonomy`'s task 6.4b (same underlying
  limitation: requires an interactive VS Code Extension Development Host
  session this agent cannot drive). Both scenarios (assisted → picker,
  semi-autonomous/autonomous → chain panel) are covered by
  `commands.test.ts`'s `openspec-ui.runWithHarness` describe block (5
  tests) and `ai-panel.test.ts`'s existing chain-dispatch tests instead —
  a mocked-VS-Code-API test, not a live one.

## 3. Standalone webui integration

- [x] 3.1 "Run with Agentic Harness" button in the Change Editor tab, next
  to "Load change" — calls `resolveRunWithHarnessDispatch` (task 1.1) for
  the selected `editorChangeName`; `"picker"` switches to the "Run a
  Command" tab pre-loaded with that change's directory (reusing the
  existing single-stage flow unchanged); `"chain"` renders
  `HarnessChainPanel` inline in the Change Editor tab itself (no new tab
  added).
- [x] 3.2 `run-with-harness-dispatch.test.ts` covers both dispatch paths
  (see 1.2) — `standalone-entry.tsx` itself has no direct test file (a
  bootstrap script mounted on import, matching `extension-entry.tsx`'s
  same untested-by-design shape elsewhere in this package), so the
  decision logic was deliberately extracted into that separately testable
  module rather than left inline and untestable.

## 4. Spec and verification

- [x] 4.1 `openspec/specs/agentic-harness/spec.md` delta (this change's
  `specs/agentic-harness/spec.md`) — new requirement for the entry
  point's dispatch behavior (written before implementation, verified
  still accurate against what was actually built).
- [x] 4.2 `openspec change validate --strict agentic-harness-run-menu` —
  passes.
- [x] 4.3 typecheck/lint/test for `webui`, `extension` (and, since core
  changed too, `core`/`server`/`cli`) — workspace-wide `npm run
  typecheck`/`npm run lint`/`npm run test`, all green (694 tests total
  across all five packages). Found and fixed a real regression during
  this work: `resolveRunWithHarnessTarget` re-exported as a value from
  `@openspec-ui/core/browser` initially pulled `harness-config.ts`'s
  `node:fs/promises`/`node:path` imports into the standalone browser
  bundle (`packages/server/src/static.test.ts` failed loudly) — fixed by
  extracting it into `harness-dispatch.ts` (see 1.1). The two Extension
  Host smoke-test scenarios from 2.3 are **not** recorded in a
  `smoke-test-notes.md` — they were not run; see 2.3.
- [x] 4.4 Version bump via `npx changeset` — `.changeset/
  agentic-harness-run-menu.md` added, not yet applied.
