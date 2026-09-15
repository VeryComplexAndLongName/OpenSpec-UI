---
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
"@openspec-ui/server": patch
---

The web UI now uses Metro UI 5.1 controls. Buttons, fields, selects,
textareas and tables are drawn by Metro, from a trimmed copy kept in the
repository, so nothing is loaded from a CDN.

- **Colours.** The main action on each form stands out, and actions that
  stop or discard something are marked in an alert colour.
- **Standalone.** The shell has a dark theme. It follows the operating
  system until you choose one with the new toggle in the header, and then
  remembers your choice.
- **Inside VS Code.** Every Metro colour comes from your editor theme,
  whether light, dark, high contrast or third-party, and the panels follow
  a theme switch without reopening.
