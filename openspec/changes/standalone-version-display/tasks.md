## 1. Core: own version constant

- [x] 1.1 `packages/core/src/version-info.ts`: `getCoreVersion()`, read
  from `packages/core/package.json` via `createRequire` (not hardcoded —
  stays correct across version bumps). **Lazy function, not a top-level
  constant** — see 5.1, CI caught a real bundling bug that an eager
  constant caused.
- [x] 1.2 `version-info.test.ts`: `getCoreVersion()` matches the
  package's own `package.json` version, and is idempotent. 2/2 passing.
- [x] 1.3 Export from `index.ts`. Not exported from `browser.ts` — uses
  `node:module`, Node-only.

## 2. Server: versions endpoint

- [x] 2.1 `server.ts`: `getServerVersion()` (own `package.json` via
  `createRequire`, same lazy pattern as core — see 5.1), `GET
  /api/versions` returning `{ core, server }`, gated by the same token
  check every other `/api/` route already goes through.
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

## 5. CI-caught bundling bug, fixed post-review

- [x] 5.1 CI's "Extension integration and package" job failed: extension
  activation threw `TypeError: The argument 'filename' must be a file
  URL object... Received undefined` from `createRequire(import.meta
  .url)` inside `../core/src/version-info.ts`, bundled transitively into
  the VS Code extension's CJS `dist/extension.js` (the extension never
  calls `getCoreVersion` itself, but `@openspec-ui/core`'s wildcard
  index export pulls the module in for every consumer, and the eager
  top-level `const` evaluated the broken call at import time regardless
  of whether anything used it). Root cause of the original smoke-test
  gap: this branch's proposal.md said "No change to the VS Code
  extension," which was true of the source diff but not of the
  transitively-bundled runtime — `npm run test:integration` was never
  run on this branch before pushing, only on branches that directly
  touched `packages/extension/src/**`. Fixed by making `getCoreVersion`
  a lazy, cached function instead of a top-level constant, so the
  `createRequire` call only executes for callers that actually invoke
  it (today, only `packages/server`) — the extension pulls in the
  module but never calls the function, so it's never affected.
- [x] 5.2 Same defect, same fix, in `packages/server/src/server.ts`'s
  own `SERVER_VERSION` → `getServerVersion()`: `packages/server` is
  *also* bundled into the extension's `dist/extension.js`, for its
  optional local-server mode (`openspec-ui.transport.localServer
  .enabled`) — confirmed by a second, initially-hidden failure in the
  same integration suite ("mode-toggle: enabling the localhost setting
  starts the same server/standalone bundle used by standalone-app") that
  only surfaced locally after fixing 5.1, since the first crash aborted
  the run before that test could execute.
- [x] 5.3 Re-ran `npm run test:integration --workspace openspec-ui-vscode`
  locally after both fixes: 6/6 passing, including the previously-failing
  mode-toggle test. Full `npm run test` re-run for `packages/core`
  (156/156), `packages/server` (39/39), `packages/webui` (112/112),
  `packages/extension` (89/89) — all green.
- [x] 5.4 Lesson applied going forward: any change touching
  `packages/core` or `packages/server` needs a real
  `npm run test:integration --workspace openspec-ui-vscode` run before
  shipping, not just "the extension's own source wasn't touched" as a
  reason to skip it — both packages are bundled into the extension too.
