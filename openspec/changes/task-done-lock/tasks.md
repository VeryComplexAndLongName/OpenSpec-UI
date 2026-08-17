## 1. Extension: withhold delete for done tasks

- [x] 1.1 `changes-tree.ts`: `TaskTreeItem` — new `openspec-ui.activeTaskDone`
  contextValue for a done task in an active change (distinct from
  `openspec-ui.activeTask`); tooltip explains why delete is withheld.
  `openspec-ui.archivedTask` unchanged (archived always wins over
  done-state).
- [x] 1.2 `commands.ts`: `openspec-ui.deleteTask` — guard extended to
  `item.done`, same fail-closed pattern as the existing `item.archived`
  no-op.
- [x] 1.3 `package.json`: no change needed — the existing
  `"when": "viewItem == openspec-ui.activeTask"` menu entry already
  excludes the new `openspec-ui.activeTaskDone` contextValue.
- [x] 1.4 `changes-tree.test.ts`: done active task gets
  `openspec-ui.activeTaskDone`, not `openspec-ui.activeTask`.
- [x] 1.5 `commands.test.ts`: `deleteTask` no-ops for a done task without
  prompting, same as the existing archived-task test.

## 2. Verification, versioning, and smoke test

- [x] 2.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/extension`. Re-run `npm run verify` after `git add`/commit of
  all new files.
- [x] 2.2 Bump `package.json` version (patch) for `openspec-ui-vscode`.
  Add a `packages/extension/CHANGELOG.md` entry and a README line.
- [x] 2.3 Manual smoke test: real Extension Host run via
  `npm run test:integration` (6/6 passing), plus a real `readTaskChecklist`
  run against a temp `tasks.md` confirming done-state is read correctly.
  Full detail in `smoke-test-notes.md`.
- [x] 2.4 `openspec change validate --strict task-done-lock` passes.
