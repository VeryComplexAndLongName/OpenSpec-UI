# Changelog

## 0.1.0

Initial local build (not published to the Marketplace — see README.md).

- Command Palette: `OpenSpec UI: Plan/Implement/Review/Status/Cancel`, plus
  `Open AI Panel`, `Refresh`, `Review Diff (tasks.md vs HEAD)`.
- Activity bar view container with three tree views: Changes, Archive, Specs
  — status/requirement counts computed by `@openspec-ui/core` (single source
  of truth, not recomputed here).
- Primary mode: direct `@openspec-ui/core` import in the extension host +
  in-process message bridge to the AI panel Webview (no local network port).
- Optional mode (`openspec-ui.transport.localServer.enabled`): spawns the
  same `@openspec-ui/server` package used by the standalone tool, on a
  dynamic port, and points the Webview at it instead.
- Native VS Code integration: `vscode.open` for proposal/spec markdown,
  `vscode.diff` against the file's `HEAD` revision (via the built-in Git
  extension) for change review — no custom diff/markdown UI in the Webview.
- Verified with a live run inside a real VS Code Extension Development Host
  (`@vscode/test-electron`) — see `../../openspec/changes/vscode-extension/TEST-NOTES.md`.
