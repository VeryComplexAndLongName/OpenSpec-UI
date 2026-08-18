## Why

`repo-bootstrap-snippets` shipped three real, working commands
("Generate Agent Instructions", "Configure Dependabot", "Generate
Path-Scoped Copilot Instructions"), but by design.md decision made them
Command Palette-only — no tree or menu presence. In live use, this
turned out to be the same discoverability gap already fixed twice this
session for other features (Customize Template's missing feedback,
fixed in `customize-template-open-manifest`; the CLI-agent picker's
missing README pointer, fixed in `discoverable-agent-picker`): a
feature that works but that nobody finds because nothing in the UI
points at it. Unlike those two prior fixes, a README pointer alone
wasn't judged enough here — these commands need an actual visible entry
point in the tree, not just better docs.

## What Changes

- Adds a "Repository Setup" node at the top of the **Changes** tree
  (right after "OpenSpec Configuration"), always present regardless of
  workspace state. Expanding it lists the three existing commands as
  leaf items; clicking one runs that exact command — including its
  existing project-type `QuickPick` prompt, unchanged.
- No new commands, no duplicated project-type-selection logic: the tree
  items are thin pointers at the commands that already existed
  (`openspec-ui.generateAgentInstructions`,
  `openspec-ui.configureDependabot`,
  `openspec-ui.generateSubtypeInstructions`), registered in
  `repo-bootstrap-snippets`.
- Archive tree unaffected — repository setup isn't archive-scoped, so it
  only appears in **Changes**, matching how "OpenSpec Configuration"
  already only appears there today.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension`: the Changes tree now surfaces the three
  repo-bootstrap commands as a visible node, not Command Palette-only.

## Impact

- `packages/extension/src/tree/changes-tree.ts`
  (`RepoBootstrapRootTreeItem`, `RepoBootstrapActionTreeItem`,
  `getRepoBootstrapActions()`, wired into
  `ChangesTreeProvider.getChildren`).
- `packages/extension/src/tree/changes-tree.test.ts`.
- No change to `commands.ts` or `package.json` — the three commands
  already existed and are invoked unchanged via `TreeItem.command`, the
  same mechanism `EmptyTreeItem`'s "Initialize OpenSpec" already uses.
