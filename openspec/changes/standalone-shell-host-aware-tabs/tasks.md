## 1. Tab shell component

- [x] 1.1 Add a minimal `Tabs`/`TabPanel` pair (no new npm dependency) to
  `packages/webui/src/` (e.g. `components/Tabs.tsx`), with unit tests in
  `Tabs.test.tsx` covering: only the active tab's children render, switching
  tabs preserves unmounted-vs-mounted state per the design's "hidden tabs do
  not mount" decision.
- [x] 1.2 Add `openspec-*` CSS classes for the tab bar to `shell-ui.ts`
  (`shellThemeCss`), consistent with existing panel styling.

## 2. Standalone shell restructuring

- [x] 2.1 Wrap the five existing sections in `standalone-entry.tsx` ("Run a
  Command", "Processes and Recovery", "Diff Preview", "OpenSpec view
  summary", "Change Editor") in the new `Tabs`/`TabPanel` components,
  replacing the current vertical `<section className="openspec-shell-panel">`
  stacking with tab navigation. No content changes to the sections
  themselves.
- [x] 2.2 Add an `ALLOWED_TABS_VSCODE_EMBED = ["run-a-command"]` constant (or
  equivalent) and the full `ALL_TABS` list in `standalone-entry.tsx`, so the
  allowed-tab set is a single named export a test can assert against
  (supports the design's mitigation for the "sixth section" risk).
  Implemented as `packages/webui/src/host-embed.ts` (pure functions,
  re-exported/used by `standalone-entry.tsx`) rather than inline constants,
  so the tab-selection logic is unit-testable without importing the
  bootstrap entry file — see task 3.3.

## 3. Embed-context detection

- [x] 3.1 In `standalone-entry.tsx`, read `embed` from
  `new URLSearchParams(window.location.search)` at module init (next to the
  existing `readAccessToken()` call) and compute
  `isVsCodeEmbed = embed === "vscode-local-server"` before
  `createRoot(...).render(...)`.
- [x] 3.2 Use `isVsCodeEmbed` to select `ALLOWED_TABS_VSCODE_EMBED` vs.
  `ALL_TABS` as the tab set passed to `Tabs`, and to force the active tab to
  `"run-a-command"` when embedded.
- [x] 3.3 Add a test (e.g. in a new `standalone-entry.test.tsx` or wherever
  `standalone-entry.tsx` is currently tested) asserting: with
  `?embed=vscode-local-server` in `window.location.search`, only the "Run a
  Command" tab renders; without it, all five tabs render.
  `standalone-entry.tsx` mounts to `#root` as a side effect on import, so it
  cannot itself be imported in tests (consistent with it never having had a
  test file). Covered instead by `host-embed.test.ts` (pure
  `computeVisibleTabs`/`readEmbedSignal` logic) and
  `components/Tabs.test.tsx` ("Tabs with computeVisibleTabs" — renders the
  actual `Tabs` component with both tab sets and asserts DOM output), plus
  an end-to-end browser check in task 4.3.

## 4. Extension: mark the local-server iframe

- [x] 4.1 In `packages/extension/src/webview/ai-panel.ts`,
  `getLocalServerHtml(baseUrl)` builds the iframe `src` as
  `${baseUrl}?embed=vscode-local-server` instead of `${baseUrl}` (`URL`
  construction, not string concatenation, to correctly merge with any
  existing query/hash in `baseUrl`).
- [x] 4.2 Update `ai-panel.test.ts` to assert the iframe `src` produced by
  `getLocalServerHtml` includes `embed=vscode-local-server`.
- [x] 4.3 Manual smoke test: enable `openspec.transport.localServer.enabled`
  in a real VS Code Extension Development Host, open the OpenSpec UI panel,
  confirm only "Run a Command" is visible; then open the same server's
  launch URL directly in a plain browser tab and confirm all five tabs are
  visible. Record the result in a `smoke-test-notes.md` in this change
  directory (see `openspec/changes/archive/2026-08-13-standalone-app/smoke-test-notes.md`
  for the existing convention).
  See `smoke-test-notes.md`: the plain-standalone and embed-signal scenarios
  were verified live in a real browser against a real running server (both
  pass); the literal "inside a real VS Code Extension Development Host"
  step was **not** performed — no interactive VS Code is available in this
  environment — and is called out explicitly as a remaining gap rather than
  claimed as done. This smoke test also caught and fixed a real bug: the
  server's static router 404'd on any query string at `/`, which would have
  made the embed signal unreachable (see task 5.1 note).

## 5. Verification and versioning

- [x] 5.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/webui` and `packages/extension`.
  Also run (and passing) for `packages/server`: the smoke test in task 4.3
  found that `tryServeStatic` (`packages/server/src/static.ts`) matched
  `req.url` against `"/"` by exact string equality, so a query string (e.g.
  the new `?embed=vscode-local-server`) caused a 404 instead of serving
  `index.html`. Fixed to match on pathname only, with a new regression test
  in `static.test.ts`.
- [x] 5.2 Bump `packages/webui/package.json` and
  `packages/extension/package.json` versions (minor) per
  `openspec/config.yaml` versioning rules.
  webui 1.2.2 → 1.3.0, extension 0.4.3 → 0.5.0 (minor). Also bumped
  `packages/server` 1.2.3 → 1.2.4 (patch) for the static-routing fix above,
  per config.yaml's "version bump is mandatory in sync with every
  externally visible behavior change" — not anticipated in design.md, added
  because the fix was needed to make this change work at all.
- [x] 5.3 `openspec change validate --strict standalone-shell-host-aware-tabs`
  passes.
