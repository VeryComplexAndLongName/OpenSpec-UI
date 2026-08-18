## 1. Extension: real nesting under the Tasks artifact

- [x] 1.1 `changes-tree.ts`: `TasksArtifactTreeItem` (collapsible when
  `exists`, contextValue `openspec-ui.tasksArtifact`, keeps the existing
  open-on-click `.command`), `getChangeChildren` rewritten to be
  synchronous and return only artifacts (the "tasks" kind rendered as
  `TasksArtifactTreeItem` instead of a plain leaf), new
  `getTasksArtifactChildren` (async, lazy — only called when Tasks is
  actually expanded).
- [x] 1.2 `ChangesTreeProvider.getChildren` / `ArchiveTreeProvider
  .getChildren`: dispatch `element instanceof TasksArtifactTreeItem` to
  `getTasksArtifactChildren`, alongside the existing `ChangeTreeItem`
  dispatch.
- [x] 1.3 `extension.ts`: `ExtensionTestApi.changesTree` — new,
  test-only export of the registered `ChangesTreeProvider`, so
  integration tests can drive the real provider instead of only
  asserting against a mocked-`vscode` unit test.
- [x] 1.4 `src/test/suite/extension.test.ts`: new live test against the
  real fixture workspace (`openspec/changes/demo/tasks.md`) — walks
  `api.changesTree.getChildren()` two levels deep in a real Extension
  Host and asserts (a) no task items appear flat under the Change, (b)
  the Tasks artifact is collapsible, (c) expanding it returns the real
  fixture's checklist item. This is the check that would have caught the
  original bug immediately — `tree-item-stable-ids`'s unit tests against
  a mocked `vscode` module were structurally correct but tested the
  wrong invariant (identity, not nesting), which is why that fix shipped
  clean and the reported symptom didn't change at all.
- [x] 1.5 `changes-tree.test.ts`, `archive-tree.test.ts` rewritten for
  the two-level expand: Change → artifacts (Tasks among them, no task
  items flat) → Tasks artifact → task items. New test confirms
  `readTaskChecklist` is not called until Tasks is actually expanded.
  10/10 passing.

## 2. Verification, versioning, and smoke test

- [x] 2.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/extension` (99/99).
- [x] 2.2 Manual smoke test: real Extension Host run via
  `npm run test:integration` — 7/7 passing, including the new live tree
  test (1.4). Confirmed genuinely live, not accidentally green: it
  failed on the first run with a real assertion mismatch (fixture text
  has a trailing period I'd initially omitted), proving the test
  actually exercises the real code path rather than trivially passing.
- [x] 2.3 Bump `package.json` version (minor — real behavior change to
  an existing capability, not just a bug fix) for `openspec-ui-vscode`.
  CHANGELOG entry, README Features bullet, root README version table.
- [x] 2.4 `openspec change validate --strict
  nest-tasks-under-tasks-artifact` passes.
