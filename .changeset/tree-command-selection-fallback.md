---
"openspec-ui-vscode": patch
---

Tree-scoped commands now act on the row highlighted in the tree when they are invoked without one. The Command Palette always invokes a command with no arguments — only a tree's own right-click menu passes the clicked item — so running "OpenSpec UI: Archive Change" from the palette with a change highlighted reported `select a change in the tree first`, telling the user to do what they had already done. The Changes, Archive and Templates views are now registered with `createTreeView`, whose handle exposes `selection`, and each command falls back to that selection when exactly one row of the kind it expects is highlighted in the view that owns it. Several rows, a row of another kind, or nothing selected all still refuse, because picking one of them would be a choice the user never made; the state checks and the modal confirmations each command already performs are unchanged. The warning now names the right-click menu as the alternative.
