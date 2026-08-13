## Context

See proposal.md and `docs/adr/0001-*.md`. `webui` must not care whether it is
running in browser standalone or VS Code Webview; the only environment-specific
logic is encapsulated in selected `Transport`.

## Goals / Non-Goals

**Goals:**
- One component codebase for both delivery forms.
- Clear boundary between responsibilities handled inside `webui` vs delegated
  to host (especially markdown editing and diff rendering).

**Non-Goals:**
- Does not implement transport infrastructure itself (`execution-core`,
  `standalone-app`, `vscode-extension` do that); only consumes the interface.
- Does not provide in-Webview markdown editing for VS Code extension;
  editing is delegated to VS Code native editor.
- Does not implement git commit/branch/merge UI.

## Decisions

- **`Transport` interface with `send(command)` and `subscribe(onEvent)`**:
  `FetchTransport` uses `fetch` + `EventSource`/WebSocket;
  `MessageBridgeTransport` uses
  `acquireVsCodeApi().postMessage` + `window` message events.
  Components use only this interface.
- **Markdown in `webui` is read-only; editing is delegated where host supports
  it**: VS Code opens native files; standalone can use a minimal
  editor+preview.
- **Diff uses custom renderer only where host does not provide one**
  (standalone). In extension mode, `vscode.diff` is used instead.
  - Rejected alternative: always use one custom diff renderer for visual
    uniformity. Rejected because VS Code diff UI is richer and users should get
    native capabilities.

## Risks / Trade-offs

- [Risk] Two transport adapters may diverge in error handling behavior.
  Mitigation: contract tests run same scenarios (including connection drop)
  through both adapters and require equivalent observable events.
- [Risk] Delegating diff/markdown editing to host means standalone and
  extension are not pixel-identical.
  Trade-off accepted in favor of better UX quality over strict visual parity.