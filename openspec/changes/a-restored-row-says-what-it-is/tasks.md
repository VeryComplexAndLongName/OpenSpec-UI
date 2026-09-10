A row rebuilt with a state written into it, drawn by VS Code when it
restores the tree after a reload.

## 1. The child carries its parent

- [x] 1.1 `packages/extension/src/tree/changes-tree.ts`: `ArtifactTreeItem`
  and `TasksArtifactTreeItem` each carry the `ChangeTreeItem` they were
  built under, set by `getChangeChildren`.
- [x] 1.2 `getWorkbenchParent` returns that reference, and `undefined`
  where there is none. The `"draft"` literal and the comment calling the
  state a placeholder are removed.

## 2. Tests

- [x] 2.1 `changes-tree.test.ts`: `getParent` of a proposal and of the
  tasks artifact returns a row whose `state` and `description` are the
  change's own, over a workspace whose change is `implemented` — the
  case that fails today. Asserting the id alone is what let this
  through.
- [x] 2.2 `archive-tree.test.ts`: the same for an archived change, whose
  state is `archived`.
- [x] 2.3 An artifact with no owning change still resolves to no parent.

## 3. Verification

- [x] 3.1 `openspec validate --strict --changes`.
- [x] 3.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Run 2026-09-10: exit 0 — 48 cli, 835 core, 312 extension, 70
  server, 346 webui.
- [x] 3.3 Version bump via `npx changeset` for the extension.
- [ ] 3.4 **Delegated to copilot-cli**: in the VS Code integration suite,
  build a workspace with one fully ticked change, select its `tasks.md`
  row, reload the window, and assert the change row's description reads
  `implemented`. Evidence to record here: the test name and the run that
  passed. This is the reported symptom, and the unit tests above cover
  the cause rather than the reload itself.
