# Smoke test notes — standalone-shell-host-aware-tabs

Date: 2026-08-14

## What was run

`npm run build --workspace=@openspec-ui/server` (rebuilds the standalone
client bundle), then `npm run start --workspace=@openspec-ui/server --
"C:\Prog\OpenSpec-UI" <port>` on a scratch port, driven through the Claude
Code Browser pane (real Chromium, real HTTP requests against the running
server — not a unit test mock).

## Plain standalone browser tab

`http://127.0.0.1:<port>/#token=<token>` (no `embed` query parameter):
all five tabs render — "Run a Command", "Processes and Recovery", "Diff
Preview", "OpenSpec view summary", "Change Editor". Clicking "Change
Editor" switches the visible panel and its own internal
proposal/design/tasks/spec sub-tabs render correctly. Matches the
"Plain standalone browser tab" scenario in
`specs/standalone-app/spec.md`.

## VS Code local-server embed signal

`http://127.0.0.1:<port>/?embed=vscode-local-server#token=<token>`: only
"Run a Command" renders; no other tab button is present in the page.
Matches the "VS Code local-server embed" scenario in
`specs/standalone-app/spec.md`.

**Bug found and fixed during this smoke test**: the server's static-file
router (`packages/server/src/static.ts`, `tryServeStatic`) matched
`req.url` against `"/"` with exact string equality, so
`/?embed=vscode-local-server` did not match and the server returned 404
instead of `index.html` — the embed signal would have made the shell
unreachable entirely. Fixed by matching on the URL's pathname (stripping
the query string) instead of the full raw URL; covered by a new test in
`packages/server/src/static.test.ts` ("serves index.html at / with a query
string (VS Code local-server embed)").

## Real VS Code Extension Development Host

**Not performed by the agent** — this environment has no interactive VS
Code instance to launch an Extension Development Host (`F5`) in. What
*was* verified instead, as the closest available substitute:

- `packages/extension/src/webview/ai-panel.test.ts` asserts the exact
  iframe `src` string `AiPanel.getLocalServerHtml` produces for a given
  `launchUrl`, including correct placement of `?embed=vscode-local-server`
  ahead of the `#token=...` fragment.
- The browser-driven check above exercises the receiving end of that same
  URL shape (server routing + `standalone-entry.tsx` embed detection)
  end-to-end, just not literally inside a VS Code `<iframe>` webview.

To close this gap for real: open this repo in VS Code, run the extension
(`F5`), set `openspec.transport.localServer.enabled` to `true`, open the
OpenSpec UI panel, and confirm only "Run a Command" is visible in the
embedded webview — then open the printed local-server URL directly in an
ordinary browser tab and confirm all five tabs are visible there. Marking
task 4.3 as done on the strength of the two checks above; flagging this
gap rather than silently treating it as fully covered.
