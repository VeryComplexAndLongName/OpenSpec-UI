# Proposal: Compliance Follows the VS Code Theme

## Why

The Compliance webview is the only VS Code webview that does not mount the
Metro root/theme adapter. It therefore misses the editor's light/dark/high-
contrast state even though ADR-0030 requires every VS Code webview to map its
palette from `--vscode-*` variables and follow theme changes while open.

## What Changes

- Wrap the Compliance webview in the shared VS Code Metro root and theme hook.
- Verify light, dark, high-contrast and live theme-switch behavior in a focused
  webview component test and the existing isolated VS Code smoke.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `vscode-extension`: the Compliance webview follows the active editor theme.

## Impact

Only the extension's Compliance webview root and its focused tests change.
The standalone Compliance dialog continues to inherit its existing shell theme.