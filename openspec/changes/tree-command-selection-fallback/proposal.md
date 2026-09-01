## Why

Reported live on 2026-09-01, immediately after
`tree-command-selection-feedback` shipped and was verified: the user
highlighted a change in the Changes tree, ran `OpenSpec UI: Archive
Change` from the Command Palette, and got
`OpenSpec UI: select a change in the tree first.` — while a change *was*
selected.

The message is accurate about the mechanism and misleading about the
situation. VS Code's Command Palette invokes a command with no arguments;
only the tree's own right-click menu passes the clicked item. A
highlighted row is therefore invisible to the command, and the user is
told to do the thing they already did.

`tree-command-selection-feedback`'s design named this exact gap as a
Non-Goal — "Making these commands actually work without a tree selection
... is a real, larger feature ... A QuickPick-fallback change can build on
top of this one later." The live report shows the smaller, more direct
version is what is actually wanted: not a new picker, but honouring the
selection the user already made.

`packages/extension/src/extension.ts:114-130` registers all five views
with `vscode.window.registerTreeDataProvider`, which returns only a
disposable. The selection is reachable only through
`vscode.window.createTreeView`, whose returned `TreeView` exposes a
`selection` array.

## What Changes

- `packages/extension/src/extension.ts`: register the views whose items
  commands act on via `createTreeView` instead of
  `registerTreeDataProvider`, and keep the returned handles.
- `packages/extension/src/commands.ts`: when a tree-scoped command is
  invoked without an item, fall back to the matching view's current
  selection before giving up. The existing warning stays, but is now
  reached only when there is genuinely nothing selected.
- Wording of the warning is revised to name the real remedy for the
  remaining case.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension`: a tree-scoped command invoked from the Command
  Palette acts on the row highlighted in the tree, instead of refusing.

## Impact

- `packages/extension/src/extension.ts`, `commands.ts`, and their tests.
- No `core`/`server`/`webui` change.
