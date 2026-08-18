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
- Full `npm run test` suites for `packages/core` (155/155),
  `packages/server` (39/39), `packages/webui` (112/112) all passing,
  including the new `version-info.test.ts` and the new `/api/versions`
  test in `server.test.ts`.
