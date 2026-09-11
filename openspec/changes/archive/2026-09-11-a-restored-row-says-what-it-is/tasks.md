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
- [x] 3.4 **Delegated to copilot-cli**: in the VS Code integration suite,
  build a workspace with one fully ticked change and assert the row
  `getParent` returns for its `tasks.md` is the change's own row,
  reading `implemented`.

  Premise corrected: the item asked for a window reload. That cannot be
  done from inside the suite — `workbench.action.reloadWindow` restarts
  the extension host the test is running in, so the run dies with it.
  What a reload does that matters here is restore the tree's selection
  by walking `getParent`, and that is exactly what this asserts, in a
  real Extension Host against a real workspace. Said rather than
  quietly narrowed.

  Evidence: `packages/extension/src/test/suite/extension.test.ts`,
  "Changes tree keeps an implemented change as the parent of its tasks
  row after refresh". It writes a fully ticked `tasks.md`, refreshes,
  and asserts both that the parent is the same row object and that its
  description reads `implemented` — identity is the fix, the
  description is what a person sees. Run 2026-09-11: 17 passing, 22s.

  The test was written by `copilot-cli`; the second assertion was added
  when this item was closed, because identity alone does not say what
  the reader would have seen.
