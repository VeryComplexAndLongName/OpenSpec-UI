# Live test notes — vscode-extension

Date: 2026-08-03. Performed as part of tasks.md 4.1/4.2/4.3, via
`@vscode/test-electron` (`packages/extension/src/test/run.mjs`) — a real
VS Code Extension Development Host, not a `vscode` mock.

## Environment

Same as in `openspec/changes/standalone-app/smoke-test-notes.md`:
- `claude` CLI — installed, not authorized in this environment.
- `copilot` CLI — authorized and working.
- `codex`/`gemini` — not installed.

## Test procedure

A disposable temp workspace (not in the repository — the same safety
considerations as standalone-app: `plan`/`implement` are real CLI-agent
invocations with tool access, running them with cwd on the real repository
as part of a smoke test would be unacceptable), with a fake
`openspec/changes/demo/`. Extracted from the VS Code stable 1.131.0
repository (downloaded by `@vscode/test-electron`), launched an Extension
Development Host with `--disable-extensions` (built-in extensions like
`vscode.git` remain active — the flag only disables user/marketplace
extensions).

### Result — 5/5 tests passed

1. The extension activates, all 8 contributed commands are registered.
2. The `AgentRunner` registry is built directly (no network) for all 5 agents.
3. The primary mode is serverless by default (the local server is NOT running).
4. **A real `plan` run through `copilot-cli`**: `started` → a real Copilot
   response (it noticed the empty task description and asked for
   clarification — the correct reaction) → `completed`. ~35s, real AI
   Credits spent.
5. **Switching to the local server** (`openspec-ui.transport.localServer.enabled`):
   the server comes up on a dynamic port, serves the same standalone shell
   (`<div id="root">` in the HTML), disabling the setting stops the server.

## Bugs found and fixed

All three are variants of the same problem: Windows resolves certain
CLIs/binaries as `.cmd` shims, which `node:child_process`'s `spawn`/`execFile`
cannot launch directly without `shell: true` (`ENOENT`), while `shell: true`
directly is unsafe wherever arguments contain data from change-file content.

1. **The `copilot` CLI was spawned directly** (`agents/shared.ts`) — fixed
   by switching to `cross-spawn` (see `standalone-app/smoke-test-notes.md`,
   found there, before this run).
2. **The `openspec` CLI (the binary itself, invoked by `core/openspec.ts`'s
   `listChanges`/`listSpecs`/`showChange`/`validateChange`) was spawned via
   plain `execFile`** — the same `ENOENT` on Windows, found specifically by
   this run (unit tests mocked `child_process` wholesale and did not catch
   this; standalone-app's smoke test did not call the `openspec` CLI
   directly). Fixed: `openspec.ts` was switched to the same `cross-spawn`
   pattern as `agents/shared.ts` (`@openspec-ui/core@0.5.1`).
3. **`server/src/static.ts` crashed on import inside the bundled CJS
   build** (`import.meta.url` is `undefined` under `esbuild --format=cjs`,
   `fileURLToPath(undefined)` throws a `TypeError` at the module's top
   level, before the calling code gets a chance to pass a `staticAssets`
   override). Found specifically by the "switching to the local server"
   test (the only path that actually imports `@openspec-ui/server` from
   the bundled `extension.js`). Fixed: computing the default paths became
   lazy and wrapped in try/catch (`@openspec-ui/server@0.1.3`).

## Conclusion

`claude-cli` and `copilot-cli` are the only agents available for live
testing at this phase of development (see `execution-core` tasks.md 2.8,
`standalone-app` tasks.md 3.2). `copilot-cli` was confirmed fully working
end-to-end in both standalone and vscode-extension. `codex-cli`/`gemini-cli`
remain validated only by mocks/contract tests.

The value of this run is not that it "passed on the first try" (it did
not: it found 2 new real bugs beyond the one already known from
standalone-app), but that a live run inside actual VS Code catches exactly
the bugs that unit tests with `vscode`/`child_process` mocks structurally
cannot catch.
