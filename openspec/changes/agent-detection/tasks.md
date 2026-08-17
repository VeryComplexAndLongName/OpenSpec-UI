## 1. Core: detection

- [x] 1.1 Add `packages/core/src/agent-detection.ts`:
  `detectAvailableAgents(config?: { localLlmBaseUrl?: string })` — for
  each `buildDefaultAllowlist()` entry, spawn `<executable> --version` via
  `cross-spawn` (3s timeout, `error`→false, `exit`→true regardless of
  code) except the `__http__` sentinel, which does a short-timeout `fetch`
  reachability check instead; all checks run in parallel via
  `Promise.all`.
- [x] 1.2 `agent-detection.test.ts`: detected via spawn exit (code 0 and
  non-zero), not detected via spawn `error`, local-llm detected/not
  detected via fetch resolve/reject, all five registered ids present in
  the result.
- [x] 1.3 Export from `packages/core/src/index.ts` (not `browser.ts` —
  depends on `cross-spawn`/Node, same reasoning as `default-runners.ts`).

## 2. Server: detection endpoint

- [x] 2.1 Add `POST /api/agents/detect` to `packages/server/src/rest.ts`/
  `server.ts`: `{cwd}` in (validated + `authorizeCwd`'d like every other
  endpoint), `{agents: Record<string, boolean>}` out, calling
  `detectAvailableAgents()`.
- [x] 2.2 `server.test.ts`: endpoint returns detection results for a real
  request; rejects an unauthorized `cwd` the same way existing endpoints
  do.

## 3. Webui: AiPanel annotation + standalone wiring

- [x] 3.1 `AiPanel.tsx`: add optional `detectedAgents?: Record<string,
  boolean>` and `onRefreshAgents?: () => void` props. Each agent
  `<option>` label gets a plain-text suffix reflecting the detection
  result when present (no suffix when the id is absent from
  `detectedAgents`, i.e. unknown/not yet loaded). Render a small "Refresh
  agents" button only when `onRefreshAgents` is supplied.
- [x] 3.2 `AiPanel.test.tsx`: option labels reflect detected/not-detected/
  unknown; clicking "Refresh agents" calls `onRefreshAgents`; button is
  absent when the prop is not supplied; picker options remain fully
  selectable regardless of detection result.
- [x] 3.3 `template-catalog-client.ts`-style thin client: add
  `detectAgents(cwd)` fetch wrapper (new file or alongside an existing
  client, matching the project's established thin-wrapper pattern) for
  `POST /api/agents/detect`.
  Added `packages/webui/src/agent-detection-client.ts` +
  `.test.ts` (2 tests).
- [x] 3.4 `standalone-entry.tsx`: call the new client on `AiPanel` mount,
  store `detectedAgents` in state, pass it plus a refresh handler into
  `<AiPanel>`. A failed request leaves `detectedAgents` as `undefined`
  (picker falls back to unannotated, not an error state).
  Implemented as a `useEffect` keyed on `[cwd, changeDir]` (same
  condition that gates rendering `<AiPanel>` at all), calling
  `handleRefreshAgents()`; the same handler is passed as
  `onRefreshAgents` for the manual "Refresh agents" button.

## 4. Extension: context-message wiring

- [x] 4.1 `packages/webui/src/extension-context.ts`: add optional
  `detectedAgents?: Record<string, boolean>` to `DashboardContext`;
  `isDashboardContextMessage` continues to only require `cwd`/`changeDir`
  strings (field stays optional, not required).
- [x] 4.2 `packages/webui/src/extension-entry.tsx`: add `detectedAgents`
  state, updated from the `context` message listener (same handler that
  already updates `cwd`/`changeDir` on every received message, not just
  initial mount); pass to `<AiPanel>` (no refresh button in this host).
  The listener only overwrites `detectedAgents` when a message actually
  carries it, so the previous result (or `undefined` on first load)
  survives the immediate `{cwd, changeDir}`-only message that precedes it.
- [x] 4.3 `packages/extension/src/webview/ai-panel.ts`: add optional
  `detectedAgents?: Record<string, boolean>` to `AiPanelContext`. In
  `reveal()`, keep posting the existing `{cwd, changeDir}` context message
  synchronously as today; separately call `detectAvailableAgents()`
  (direct `@openspec-ui/core` import) and, once it resolves, post one more
  context message carrying the same `cwd`/`changeDir` plus
  `detectedAgents`. Do this both on first panel creation and on every
  subsequent `reveal()` call.
  Added a private `detectAndPostAgents()` skipped entirely in
  optional-local-server mode (that mode's iframe already gets detection
  via the standalone REST endpoint, since it's the same browser bundle —
  running the extension-host spawn checks too would be pure waste).
- [x] 4.4 `ai-panel.test.ts`: `reveal()` posts the immediate context
  message unchanged (or, for a brand-new panel, embeds cwd/changeDir via
  HTML data attributes with no postMessage at all — matched actual
  behavior, corrected from the task's original assumption), then a
  follow-up message once detection resolves; a second `reveal()` on an
  already-open panel triggers a fresh detection round; no detection call
  at all in optional-local-server mode. 4 new tests, all passing; full
  extension unit suite (69 tests) still green.

## 5. Documentation

- [x] 5.1 `README.md`: extend the "Agent Selection" section with a short
  note that the picker shows a best-effort detected/not-detected
  annotation, and that it is not a filter or an authentication check.

## 7. Ship

- [x] 7.1 Branch `feat/agent-detection` from post-merge `origin/main` (per
  user's branch-per-task rule), commit, push,
  [PR #29](https://github.com/VeryComplexAndLongName/OpenSpec-UI/pull/29).
- [x] 7.2 CI green on the PR commit, then merge.
  All three checks (dependency review, typecheck/lint/test/build,
  extension integration + package, standalone browser + accessibility)
  passed. Merged as `be51f7a` into `main`.

## 6. Verification, versioning, and smoke test

- [x] 6.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/core`, `packages/server`, `packages/webui`,
  `packages/extension`. Re-run `npm run verify` (or at least
  `node scripts/check-english.mjs`) again **after** `git add`/commit of
  all new files, not only before.
  All four packages clean (typecheck, lint, test — 135+35+110+69 tests).
  Post-commit re-verification still pending until after `git add`.
- [x] 6.2 Bump `package.json` versions (minor) for all four touched
  packages per `openspec/config.yaml`.
  core 0.14.0 → 0.15.0, server 1.5.0 → 1.6.0, webui 1.6.0 → 1.7.0,
  extension 0.8.0 → 0.9.0. Root `README.md` version table and
  `packages/extension/CHANGELOG.md` updated too.
- [x] 6.3 Manual smoke test: verify real detection results in this
  environment (both `claude` and `copilot` CLIs are installed here per
  `agent-selection`'s `smoke-test-notes.md`; at least one other registered
  id should be genuinely absent, giving a real negative case too) for both
  the standalone browser tab and a real `@vscode/test-electron` run;
  record findings in `smoke-test-notes.md`.
  Both hosts verified live; see `smoke-test-notes.md` for full detail,
  including a real (not hypothetical) demonstration of the "different
  process PATH" risk the design.md Non-Goals section calls out.
- [x] 6.4 `openspec change validate --strict agent-detection` passes.
