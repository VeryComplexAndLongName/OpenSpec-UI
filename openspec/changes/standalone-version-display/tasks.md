## 1. Core: own version constant

- [x] 1.1 `packages/core/src/version-info.ts`: `CORE_VERSION`, read from
  `packages/core/package.json` via `createRequire` (not hardcoded — stays
  correct across version bumps).
- [x] 1.2 `version-info.test.ts`: `CORE_VERSION` matches the package's own
  `package.json` version. 1/1 passing.
- [x] 1.3 Export from `index.ts`. Not exported from `browser.ts` — uses
  `node:module`, Node-only.

## 2. Server: versions endpoint

- [x] 2.1 `server.ts`: `SERVER_VERSION` (own `package.json` via
  `createRequire`, same pattern as core), `GET /api/versions` returning
  `{ core, server }`, gated by the same token check every other `/api/`
  route already goes through.
- [x] 2.2 `server.test.ts`: authenticated request returns `{ core,
  server }` matching the actual package versions. 1 new test, 33/33
  server tests passing.

## 3. Webui: build-time webui version + standalone footer

- [x] 3.1 `packages/server/scripts/client-build-options.mjs`: esbuild
  `define` for `__OPENSPEC_UI_WEBUI_VERSION__`, read from
  `packages/webui/package.json` at build time (browser bundle has no
  filesystem access to read its own `package.json` at runtime).
- [x] 3.2 `standalone-entry.tsx`: `isStandaloneHost` (reuses
  `host-embed.ts`'s existing `readEmbedSignal`/
  `VSCODE_LOCAL_SERVER_EMBED_SIGNAL`, not a new signal); fetches
  `/api/versions` on mount when standalone; renders a footer with all
  three versions, withheld entirely under the VS Code local-server embed
  signal.
- [x] 3.3 `shell-ui.ts`: `.openspec-shell-version-footer` CSS.
- [x] 3.4 No new webui unit test — `standalone-entry.tsx` is a bootstrap
  script that mounts to `#root` on import, not unit-tested directly (see
  `openspec/changes/archive/2026-08-17-tasks-tree-expand/design.md`,
  same established boundary); the signal logic it reuses is already
  covered by `host-embed.test.ts`.

## 4. Verification, versioning, and smoke test

- [x] 4.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/core`, `packages/server`, `packages/webui`. Re-run
  `npm run verify` after `git add`/commit of all new files.
- [x] 4.2 Bump `package.json` versions (patch, no contract break) for
  `@openspec-ui/core` (0.18.1), `@openspec-ui/server` (1.7.1),
  `@openspec-ui/webui` (1.8.1). None of the three has its own
  `CHANGELOG.md`; updated root `README.md` version table.
- [x] 4.3 Manual smoke test: real server started via `tsx
  packages/server/src/cli.ts` against a temp workspace; real
  authenticated `curl` of `/api/versions` returned `{"core":"0.18.1",
  "server":"1.7.1"}`, matching the bumped `package.json` versions
  exactly. Real esbuild client build confirmed `1.8.1` and
  `openspec-shell-version-footer` both present in the built `dist/
  app.js`.
- [x] 4.4 `openspec change validate --strict standalone-version-display`
  passes.
