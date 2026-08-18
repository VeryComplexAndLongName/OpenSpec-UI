# Smoke test — standalone-version-display

- Real server start: `npx tsx packages/server/src/cli.ts <temp workspace>
  4399` — real process, real token, real HTTP listener.
- Real authenticated request: `curl -H "x-openspec-ui-token: <token>"
  http://127.0.0.1:4399/api/versions` returned `{"core":"0.18.1",
  "server":"1.7.1"}`, matching the bumped `packages/core` and
  `packages/server` `package.json` versions exactly — not a mock, the
  actual running process's own values.
- Real client build: `npm run build --workspace @openspec-ui/server`
  (real esbuild invocation, not mocked); `grep` of the resulting
  `packages/server/dist/app.js` confirmed both `1.8.1` (the
  build-time-injected `__OPENSPEC_UI_WEBUI_VERSION__`) and
  `openspec-shell-version-footer` (the footer's CSS class) are present in
  the shipped bundle.
- Full `npm run test` suites for `packages/core` (156/156),
  `packages/server` (39/39), `packages/webui` (112/112) all passing,
  including the new `version-info.test.ts` and the new `/api/versions`
  test in `server.test.ts`.

**CI caught what this notes file's original version missed:** the first
push failed "Extension integration and package" — extension activation
crashed because both new version getters used an eager top-level
`createRequire(import.meta.url)`, which breaks once `core`/`server` are
bundled into the VS Code extension's CJS `dist/extension.js` (`core`
transitively via its wildcard export, `server` for the optional
local-server mode). Real fix, not a CI workaround: made both getters lazy
functions instead of top-level constants, so the broken call only
executes for callers that actually invoke it — the extension pulls both
modules in but calls neither getter. Re-ran `npm run test:integration
--workspace openspec-ui-vscode` locally after the fix: 6/6 passing,
including a second test that had been failing for the same underlying
reason but was masked by the first crash aborting the run early. Full
detail in `tasks.md` section 5.
