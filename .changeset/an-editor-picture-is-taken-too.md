---
"openspec-ui-vscode": patch
---

The editor pictures are taken by a spec, like every other one.

Nine pictures of the editor's own views were hand-taken, on the recorded reason that no agent can drive them or capture the window. Playwright drives Electron, VS Code is Electron, and both were already here: `packages/extension/e2e` now launches the editor with the extension loaded against a fixed fixture workspace and captures all nine.

`scripts/screenshot-baseline.json` is empty, and the mechanism stays — deleting it would make the next hand-taken picture legal by silence. The `editor-native` reason is retired, being the one that turned out not to be a reason.

One caption was corrected against its fresh picture: the archived change's context menu was described as four actions and has ten.
