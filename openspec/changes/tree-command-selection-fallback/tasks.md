Mark each task `[x]` as soon as its own check passes — not in one batch
at the end, and never before the work is actually done.

Path this change must hold end to end: a row highlighted in a tree view →
`TreeView.selection` → the command handler's item resolution → the same
handler body a right-click invocation reaches. Check each junction, not
only the ends.

## 1. Expose the selection

- [ ] 1.1 `packages/extension/src/extension.ts` line ~127: register
  `openspecUiChanges` with `vscode.window.createTreeView("openspecUiChanges",
  { treeDataProvider: changesTree })` instead of
  `registerTreeDataProvider`, keep the returned `TreeView` in a local, and
  push it to `context.subscriptions` exactly as the disposable was.
- [ ] 1.2 `packages/extension/src/extension.ts` line ~128: same for
  `openspecUiArchive`.
- [ ] 1.3 `packages/extension/src/extension.ts` line ~130: same for
  `openspecUiTemplates`.
- [ ] 1.4 `packages/extension/src/extension.ts` lines ~114, ~129: leave
  `openspecUiProcesses` and `openspecUiSpecs` on
  `registerTreeDataProvider` — no command in this change's set acts on
  their items (see design.md, "Rejected alternative: switch all five").
- [ ] 1.5 `packages/extension/src/commands.ts`: extend the `deps` object
  its `registerCommands` already takes with the three `TreeView` handles,
  and pass them from `extension.ts`. Do **not** import `vscode.window`
  state inside `commands.ts` to reach them — the existing code takes
  everything it needs through `deps`, and the tests mock that object.

## 2. Resolve the item

- [ ] 2.1 `packages/extension/src/commands.ts`: add a helper
  `resolveTreeItem<T>(item: T | undefined, view: { selection: readonly
  unknown[] }, isExpectedKind: (candidate: unknown) => candidate is T): T
  | undefined` — returns `item` when given; otherwise the sole selected
  item when `view.selection.length === 1` and it passes
  `isExpectedKind`; otherwise `undefined`.
- [ ] 2.2 `packages/extension/src/commands.ts`: use it in the nine
  `ChangeTreeItem` commands that read the Changes tree —
  `configureHarnessForChange`, `runWithHarness`, `validateSelectedChange`,
  `showChangeTimeline`, `archiveChange`, `deleteChange`,
  `startImplementation`, `rollbackChange`, `reviewDiff`. Each keeps its
  existing state check unchanged after resolution.
- [ ] 2.3 `packages/extension/src/commands.ts`: use it in the two
  `ChangeTreeItem` commands that read the **Archive** tree, not the
  Changes tree — `unarchiveChange` and `copyTasksAsTemplate`.
- [ ] 2.4 `packages/extension/src/commands.ts`: use it in the three
  `TemplateTreeItem` commands against the Templates tree —
  `customizeTemplate`, `insertTemplateIntoChange`,
  `deleteProjectTemplate`.
- [ ] 2.5 `packages/extension/src/commands.ts`: use it in the two
  `TaskTreeItem` commands against the Changes tree — `revealTask`,
  `deleteTask`.
- [ ] 2.6 `packages/extension/src/commands.ts`: reword
  `warnNoTreeSelection` to name the remaining remedy, e.g. "OpenSpec UI:
  select a change in the Changes tree, or run this from its right-click
  menu." Keep one message per item kind.

## 3. Tests

- [ ] 3.1 `commands.test.ts`: a command invoked with no item and exactly
  one matching row selected acts on that row (assert the underlying
  mutating mock was called with it).
- [ ] 3.2 `commands.test.ts`: with two rows selected, the command does
  not act and warns instead.
- [ ] 3.3 `commands.test.ts`: with nothing selected, the command warns —
  the existing behavior, asserted against the new wording.
- [ ] 3.4 `commands.test.ts`: a selected item of the wrong kind (a task
  row selected while a change-scoped command runs) warns rather than
  acting on it.
- [ ] 3.5 `commands.test.ts`: `unarchiveChange` resolves from the Archive
  tree's selection and **not** from the Changes tree's — set different
  selections in the two mocks and assert which one was used.
- [ ] 3.6 `commands.test.ts`: an explicitly passed item still wins over
  any selection (right-click path unchanged).
- [ ] 3.7 Existing happy-path tests for all affected commands pass
  unmodified.

## 4. Verification

- [ ] 4.1 `openspec change validate --strict
  tree-command-selection-fallback`.
- [ ] 4.2 `npm run typecheck`/`lint`/`test --workspace openspec-ui-vscode`
  — all green.
- [ ] 4.3 `openspec/specs/vscode-extension/spec.md` delta is already
  written in this change's `specs/` directory — confirm it matches what
  was implemented; do not rewrite it.
- [ ] 4.4 Version bump via `npx changeset` (`openspec-ui-vscode`, patch).
- [ ] 4.5 **Human-only, cannot be completed by an implementing agent**:
  rebuild and reinstall (`npm run reinstall:local --workspace
  openspec-ui-vscode`), reload the window, highlight a change in the
  Changes tree, run `OpenSpec UI: Archive Change` from the Command
  Palette, and confirm it now offers to archive that change instead of
  warning. Leave unchecked if you are an agent.
