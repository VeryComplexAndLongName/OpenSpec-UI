## Why

The Pipeline panel in VS Code stops answering while the Agentic Harness runs a
chain. On 2026-09-16, with a chain in its `apply` stage, the panel showed:

- `the host did not reply within 10 seconds to pipeline/readiness`
- `the host did not reply within 10 seconds to pipeline/survey`
- `Refresh failed: the host did not reply within 10 seconds to pipeline/refresh`

The cause is one process doing both jobs. The chain runs in the extension host,
and so do the panel's readings: `pipeline/readiness` creates a git wrapper,
lists the change worktrees and diffs each branch against its base;
`pipeline/refresh` fetches refs there and then. The bridge's ceiling is a flat
10 seconds for every operation. With the machine at 100% and the chain holding
the workspace, those readings do not come back in time, and the view reports a
host that never answered.

The cards are exactly what a person wants while a chain runs — which change is
running, on which task, how far it has got — and that is when they go dark.

The same readings already answer in the browser, from the server's own
process: `/api/change-readiness`, `/api/worktree-survey`, `/api/live-runs` and
`/api/runs/ask-to-stop` are what the standalone Pipeline tab uses today.

## What Changes

- **The Pipeline panel is served by the optional local server when that server
  is enabled.** The panel then embeds the standalone shell's Pipeline tab in an
  iframe, the way the AI panel already embeds the shell, and the readings are
  taken by the server's process rather than the editor's.
- **The embed's allow-list gains the Pipeline tab.** Today
  `ALLOWED_TABS_VSCODE_EMBED` carries only `run-a-command`.
- **Opening a change from a card still opens it in the editor.** The embedded
  page posts `openspec-ui/open-change` to its parent, and the panel relays it
  to the extension after checking the sender's origin.
- **With the server off, nothing changes.** The panel keeps the message bridge
  it uses today, so the setting stays opt-in and the default path is untouched.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vscode-extension`: where the Pipeline panel's readings come from, and what
  a card can still do when they come from the server.

## Impact

- **`packages/webui`**: `src/host-embed.ts`, `src/standalone-entry.tsx` and
  their tests.
- **`packages/extension`**: `src/webview/pipeline-panel.ts` (serving the
  iframe, relaying the message, the CSP), the local server's address reaching
  the panel, `package.json`'s setting description, and the tests of both.
- **Unchanged**: the server's routes, every reading's shape, and the panel's
  behaviour when the local server is disabled.
