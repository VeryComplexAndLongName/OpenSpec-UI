## Why

`docs/adr/0001-shared-core-two-delivery-targets.md` defines the second
delivery form required by the customer. It maximizes native VS Code API usage
instead of reinventing UI (diff editor, TreeDataProvider, built-in Git API,
Tasks/Terminal API, `contributes.configuration`, optional Chat Participant
API).

## What Changes

- Add `packages/extension` with command registration (Command Palette),
  `TreeDataProvider` for Changes/Archive/Specs, and Webview panel only where
  native views are not sufficient (custom filtered list, AI panel).
- Use direct `execution-core` import in extension host with
  `MessageBridgeTransport` as primary data path for Webview.
- Add optional mode: extension can spawn `packages/server` and point Webview to
  `http://127.0.0.1:<port>` only when explicitly enabled by user.
- Delegate markdown editing and diff to native VS Code features.

## Capabilities

### New Capabilities
- `vscode-extension`: VS Code extension with direct access to
  `execution-core`, native UI where possible, Webview where needed.

### Modified Capabilities
(none)

## Impact

New code: `packages/extension/`. Depends on `execution-core` (direct import)
and `shared-ui` (Webview content). Optionally depends on `standalone-app`
`packages/server` when local-server mode is enabled.