## Why

Live bug report: the user ran "OpenSpec UI: Archive Change" (a valid,
task-complete change) and nothing happened at all — no dialog, no
message, no error. Read `packages/extension/src/commands.ts:696-698`:

```ts
vscode.commands.registerCommand("openspec-ui.archiveChange", async (item?: ChangeTreeItem) => {
  const workspaceRoot = deps.getWorkspaceRoot();
  if (!workspaceRoot || !item || item.archived) return;
```

`openspec-ui.archiveChange` is registered only against the tree's
`view/item/context` menu (`package.json`'s `menus` — right-click on a
change row, which VS Code auto-passes as `item`). There is **no**
`menus.commandPalette` section anywhere in `package.json`, so — like
every other command with a `title` — it is also fully reachable from the
Command Palette (`Ctrl+Shift+P` → "OpenSpec UI: Archive Change"), which
VS Code invokes with **zero arguments**. `item` is then `undefined`, the
guard's `return` fires immediately, and the command produces literally no
observable effect — exactly what was reported.

Auditing every command in `commands.ts` with an `item?: ...TreeItem`
parameter found this is not unique to `archiveChange` — 14 more commands
share the identical shape (`configureHarnessForChange`, `runWithHarness`,
`validateSelectedChange`, `showChangeTimeline`, `unarchiveChange`,
`copyTasksAsTemplate`, `customizeTemplate`, `insertTemplateIntoChange`,
`deleteProjectTemplate`, `deleteChange`, `revealTask`, `deleteTask`,
`startImplementation`, `rollbackChange`). Exactly one command already
gets this right — `reviewDiff`
(`packages/extension/src/commands.ts:1181-1184`):

```ts
if (!item) {
  void vscode.window.showWarningMessage("OpenSpec UI: select a change in the tree first.");
  return;
}
```

No existing test in `commands.test.ts` calls any of these 15 commands
with `item` omitted — this whole failure mode had zero test coverage,
which is how it shipped and stayed unnoticed.

## What Changes

- All 15 affected commands gain the same explicit-feedback pattern
  `reviewDiff` already uses, split out of their existing combined guard
  conditions:
  - No workspace root open: `showErrorMessage("OpenSpec UI: open a
    folder or workspace first.")` — reusing the exact wording already
    used ad hoc at three other call sites in this file
    (`createChange`/`openAiPanel`), now via a shared helper instead of
    being duplicated a fourth-through-fifteenth time.
  - No tree item passed (the actual bug): `showWarningMessage("OpenSpec
    UI: select a <change|template|task> in the tree first.")` via a
    shared helper, item-kind-appropriate wording.
  - An item *is* present but in the wrong state for this command (e.g.
    `archiveChange` called with an already-archived item, `customizeTemplate`
    called on a non-built-in template) — left as a silent no-op, unchanged:
    this state is already prevented by each command's own `when` clause in
    the tree's context menu (see design.md for why this case is out of
    scope here).
- No change to any command's actual business logic once a valid `item`
  is present — every existing test's happy-path assertions are unaffected.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension`: 15 tree-scoped commands now give explicit feedback
  instead of silently doing nothing when invoked without a tree
  selection (e.g. via the Command Palette).

## Impact

- `packages/extension/src/commands.ts`: two new small helper functions,
  guard-condition edits in the 15 affected command handlers.
- `packages/extension/src/commands.test.ts`: new tests, one "no item"
  case per affected command.
- `openspec/specs/vscode-extension/spec.md`: new requirement.
