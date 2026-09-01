---
"openspec-ui-vscode": patch
---

Fix 15 tree-scoped commands (`archiveChange`, `unarchiveChange`, `deleteChange`, `deleteTask`, `revealTask`, `runWithHarness`, and 9 others) silently doing nothing when invoked via the Command Palette with no tree item selected. They now show an explicit warning naming the kind of item required, matching the existing `reviewDiff` behavior.
