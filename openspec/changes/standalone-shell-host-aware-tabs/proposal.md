## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` decision #6 states the
extension "uses native diff, tree, Git, terminal/task, configuration, and
Chat APIs where they fit the workflow" (prefer native VS Code UI), and
`vscode-extension` spec already requires native diff ("Native diff UI is
used for review" — SHALL NOT render custom diff UI inside Webview for
extension mode). Decision #2 allows the optional local-server Webview mode
"when standalone UI parity is more important than localhost lifecycle
simplicity" — but today that parity is total: `AiPanel.getLocalServerHtml`
(`packages/extension/src/webview/ai-panel.ts`) embeds the entire standalone
shell (`standalone-entry.tsx`) verbatim in an `<iframe>`, with no requirement
governing what it shows. As a result, enabling `openspec.transport.localServer.enabled`
puts a second, custom-UI Diff Preview next to the native diff editor the
`vscode-extension` spec already mandates, and duplicates three more
native-covered areas (Processes and Recovery vs. `processes-tree.ts` +
`recovery-diagnostics.ts`; OpenSpec view summary vs. `changes-tree.ts` +
`archive-tree.ts` + `specs-tree.ts`; Change Editor vs. native file editing
via `open-doc.ts`) — a direct conflict with decision #6 that the current
specs do not catch because no requirement constrains iframe content.
Separately, `standalone-entry.tsx` is a single long scrolling page with no
internal structure, which is what let this drift happen unnoticed.

## What Changes

- Restructure the standalone shell (`packages/webui/src/standalone-entry.tsx`)
  from one long scrolling page into tabs: "Run a Command", "Processes and
  Recovery", "Diff Preview", "OpenSpec view summary", "Change Editor" — same
  content, tabbed navigation instead of vertical stacking.
- Add a host-context signal: `AiPanel.getLocalServerHtml`
  (`packages/extension/src/webview/ai-panel.ts`) marks the iframe URL it
  builds as the VS Code local-server embed (e.g. a query parameter read by
  the standalone shell at boot), distinguishing it from a plain standalone
  browser tab.
- Add host-aware tab visibility to the standalone shell: when booted under
  the VS Code local-server embed signal, show only the "Run a Command" tab;
  in plain standalone (no signal), show all five tabs.
- **BREAKING**: none — existing standalone browser users see no behavior
  change (all five tabs remain, only navigation changes from scroll to
  tabs); the local-server embed's visible content narrows, but that mode is
  opt-in and disabled by default per the existing `vscode-extension` spec.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `standalone-app`: adds a requirement that the standalone shell exposes its
  five sections as tabs, and that it hides all but "Run a Command" when
  booted under the VS Code local-server embed signal.
- `vscode-extension`: adds a requirement that the optional local-server
  Webview mode marks its iframe URL with the embed signal so the standalone
  shell can restrict its own UI to what VS Code does not already provide
  natively.

## Impact

- `packages/webui/src/standalone-entry.tsx`: tab structure, embed-signal
  detection.
- `packages/webui/src/shell-ui.ts` (or a new small module): shared tab-shell
  styling/logic usable by the standalone entry (extension-entry.tsx is
  unaffected — it never rendered these five sections).
- `packages/extension/src/webview/ai-panel.ts`: `getLocalServerHtml` iframe
  `src` construction.
- No change to `execution-core` command/event protocol; no server API
  changes.
