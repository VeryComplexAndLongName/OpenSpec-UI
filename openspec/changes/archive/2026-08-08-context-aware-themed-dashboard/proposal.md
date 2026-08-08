# Context-Aware Themed Dashboard

## Why

The Processes dashboard currently opens with empty or stale workspace fields
because its VS Code host context is not passed to the webview. It also uses a
fixed light palette, which conflicts with dark, high-contrast, and customized
VS Code themes.

## What Changes

- Initialize the dashboard workspace root from the active VS Code workspace.
- Initialize the change directory from a selected change when available, or the
  workspace `openspec/changes` directory for the Changes view title action.
- Refresh those values when an existing dashboard is revealed with new context.
- Map dashboard colors, controls, borders, focus states, and typography to VS
  Code webview theme variables without changing standalone styling.
- Bump webui and extension minor versions for the compatible UX capability.

## Capabilities

### New Capabilities

- None.

### Modified Capabilities

- `openspec-workbench`: context-aware dashboard initialization and native VS
  Code theme integration.

## Impact

- `packages/extension`: dashboard reveal context and webview bootstrap.
- `packages/webui`: extension-only context handling and VS Code theme CSS.
- Package versions: `@openspec-ui/webui` 0.3.0 and
  `openspec-ui-vscode` 0.4.0.
