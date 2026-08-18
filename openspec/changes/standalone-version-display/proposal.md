## Why

`README.md`'s own "Versioning" section already anticipates this: "package
versions — especially `core` — remain the source of truth and should be
shown separately when the UI displays build information." Nothing does
today — a user looking at the running standalone app has no way to tell
which `core`/`server`/`webui` versions they're actually running, short of
reading `package.json` files directly.

## What Changes

- The standalone browser shell shows a small footer with `core`,
  `server`, and `webui` version numbers, read from each package's own
  `package.json` rather than hardcoded.
- `core` and `server` versions come from a new `GET /api/versions`
  endpoint (token-gated like every other `/api/` route). `webui`'s own
  version is baked into the browser bundle at build time (esbuild
  `define`), since the browser has no filesystem access to read its own
  `package.json` at runtime.
- Standalone-only: withheld when running inside the VS Code local-server
  iframe (`embed=vscode-local-server`), reusing the existing host-embed
  signal — that host already shows its own extension version natively
  via VS Code's Extensions view.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `standalone-app`: adds a `GET /api/versions` endpoint and a
  standalone-only version footer in the browser shell.

## Impact

- `packages/core/src/version-info.ts` (new, `CORE_VERSION`), `index.ts`
  (export).
- `packages/server/src/server.ts` (`GET /api/versions`, `SERVER_VERSION`
  read via `createRequire`).
- `packages/server/scripts/client-build-options.mjs` (esbuild `define`
  for `__OPENSPEC_UI_WEBUI_VERSION__`, read from `packages/webui/
  package.json` at build time).
- `packages/webui/src/standalone-entry.tsx` (fetch + render the footer,
  gated on `host-embed.ts`'s existing standalone-vs-embedded signal),
  `src/shell-ui.ts` (footer CSS).
- No change to the VS Code extension — it already shows its own version
  natively via VS Code's Extensions view, and the shared webui code path
  this touches (`standalone-entry.tsx`) is standalone-only, not reused by
  `extension-entry.tsx`.
