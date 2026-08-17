## 1. Core: task checklist read/delete

- [x] 1.1 `packages/core/src/task-checklist.ts`: `TaskChecklistItem { lineNumber:
  number; text: string; done: boolean }`, `TASK_CHECKBOX_LINE_RE` (shared
  regex), `TaskListChangedError`, `readTaskChecklist(workspaceRoot,
  changeName, archived)` (via `discoverOpenSpecWorkspace`'s allowlisted
  artifact path, never a reconstructed path — same pattern as
  `readArchivedChangeTasksTemplate`), `deleteTaskLine(workspaceRoot,
  changeName, archived, lineNumber, expectedText)` (re-verifies the line's
  text before removing it; preserves the file's original line-ending
  style).
- [x] 1.2 `task-checklist.test.ts`: reads real checklist items with correct
  line numbers/done state from a fixture `tasks.md`; deletes an existing
  task (line gone, rest of file unchanged); throws `TaskListChangedError`
  for a stale line number/mismatched text without modifying the file;
  returns `[]` for a change with no `tasks.md`. 8/8 tests passing
  (also covers archived-change path and CRLF preservation, beyond the
  originally listed cases).
- [x] 1.3 Export from `packages/core/src/index.ts`.

## 2. Extension: tree expansion

- [x] 2.1 `changes-tree.ts`: `TaskTreeItem` (contextValue
  `openspec-ui.activeTask`/`openspec-ui.archivedTask`, `.command` set to
  `openspec-ui.revealTask` with itself as the argument); export
  `getChangeChildren(workspaceRoot, element)` combining the existing
  artifact-mapping logic with `readTaskChecklist`-derived task items;
  `WorkbenchTreeItem` union extended with `TaskTreeItem`.
- [x] 2.2 `ChangesTreeProvider.getChildren`/`ArchiveTreeProvider.getChildren`:
  both delegate to the shared `getChangeChildren` for a `ChangeTreeItem`
  element instead of each having their own artifact-only mapping.
- [x] 2.3 `changes-tree.test.ts`/`archive-tree.test.ts`: expanding a change
  now also returns task children with correct label/description/
  contextValue; archived task items get `openspec-ui.archivedTask`,
  active get `openspec-ui.activeTask`. 5 + 3 = 8/8 tests passing.

## 3. Extension: commands

- [x] 3.1 `commands.ts`: `openspec-ui.revealTask` — opens/reveals
  `tasks.md`, selects and centers the task's line; re-verifies the stored
  line number against current file content first, falls back to a
  whole-file text search, then to line 0, rather than failing.
  Extended `test-utils/vscode-mock.ts` with `TextEditorRevealType`,
  `Selection`, a real `lineAt().text`, and a `showTextDocument` that
  returns a usable fake editor (`selection`/`revealRange`) — none of
  these existed in the mock before this change.
- [x] 3.2 `commands.ts`: `openspec-ui.deleteTask` — no-ops for an archived
  item; modal confirmation (`showWarningMessage(..., {modal:true},
  "Delete")`, same pattern as `deleteChange`); calls `deleteTaskLine`;
  refreshes trees; `TaskListChangedError` surfaces as a warning, not
  `showCommandError`.
- [x] 3.3 `package.json`: registered `openspec-ui.deleteTask` (title,
  icon); context-menu entry `"when": "viewItem ==
  openspec-ui.activeTask"` only. `revealTask` is not added to
  `contributes.commands` (see design.md).
- [x] 3.4 `commands.test.ts`: `revealTask` opens the right document and
  sets the right selection for a fresh line number, and falls back
  correctly for a stale one; `deleteTask` respects the confirmation gate,
  no-ops for an archived item (without even prompting), calls core +
  refreshes trees on success, surfaces `TaskListChangedError` as a
  warning. 6 new tests, 33/33 extension command tests passing.

## 4. Verification, versioning, and smoke test

- [x] 4.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/core`, `packages/extension`. Re-run `npm run verify` after
  `git add`/commit of all new files.
  Ran (post-`git add`) — full repo verify passed; confirmed
  independently by CI's own "Typecheck, lint, test, and build" job on
  PR #38. Checkbox was left unmarked at the time; corrected here as
  bookkeeping only, no functional change.
- [x] 4.2 Bump `package.json` versions (minor) for `@openspec-ui/core`,
  `openspec-ui-vscode`. core 0.16.0 → 0.17.0, extension 0.10.1 → 0.11.0.
  Also added a `packages/extension/CHANGELOG.md` 0.11.0 entry, a README
  Features bullet, and caught/fixed `README.md`'s version table having
  been stale since the 0.10.1 fix (never updated then).
- [x] 4.3 Manual smoke test: real `readTaskChecklist`/`deleteTaskLine`
  runs against this repository's own `tasks.md` files where practical
  (core is Node-only, testable without VS Code); VS Code tree/editor
  interaction verified via `npm run test:integration` (real Extension
  Host) to the extent that harness can drive it, with any remaining gap
  noted explicitly in `smoke-test-notes.md` (no desktop-UI automation
  tool available in this environment, per the prior session's own
  precedent for this exact limitation).
  `readTaskChecklist` run against this very change's own live
  `tasks.md` (14 real tasks, correct); `deleteTaskLine` run against a
  real temp file (correct deletion + correct stale-rejection); real
  `@vscode/test-electron` run, 6/6 passing. Full detail in
  `smoke-test-notes.md`.
- [x] 4.4 `openspec change validate --strict tasks-tree-expand` passes.
