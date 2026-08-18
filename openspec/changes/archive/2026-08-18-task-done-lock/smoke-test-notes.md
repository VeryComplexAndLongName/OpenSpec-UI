# Smoke test — task-done-lock

- Real Extension Host run (`npm run test:integration --workspace
  openspec-ui-vscode`): 6/6 passing, extension activates and registers
  all contributed commands including `openspec-ui.deleteTask`.
- Unit tests exercise the actual new code paths, not mocks of them:
  `changes-tree.test.ts` asserts a done active task gets
  `openspec-ui.activeTaskDone` (not `openspec-ui.activeTask`), which is
  what the unchanged `package.json` `"when": "viewItem ==
  openspec-ui.activeTask"` clause relies on to withhold the menu item.
  `commands.test.ts` asserts `openspec-ui.deleteTask` no-ops for a done
  item without even prompting, mirroring the existing archived-item test.
- Live fixture check (via `tsx`, against a real temp `tasks.md`, deleted
  after): `readTaskChecklist` correctly reports `done: true`/`false` for
  a real `- [x]`/`- [ ]` line, confirming the data the tree consumes to
  pick the contextValue is correct end to end, not just in mocks.
