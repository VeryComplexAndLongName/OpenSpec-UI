## Core: real, not just mocked

Ran `readTaskChecklist`/`deleteTaskLine` directly via `tsx` (temporary
scratch scripts, deleted afterward — `git status` confirmed no trace
left):

- **`readTaskChecklist` against this repository's own live file**:
  pointed it at this very change's own `tasks-tree-expand/tasks.md`
  (self-referential, genuinely real data) — correctly found 14 tasks
  with accurate line numbers and `done` state matching the actual
  checked/unchecked boxes in the file.
- **`deleteTaskLine` against a real temp `tasks.md`**: created a 3-task
  file, deleted the middle one — confirmed via `readTaskChecklist`
  afterward (2 tasks left, correct ones) and by reading the raw file
  content directly (`- [ ] 1.2 Delete me` line genuinely gone, the other
  two untouched, headings/blank lines preserved).
- **Stale-delete rejection, for real**: immediately retried the same
  delete call (now referring to a line that no longer holds that text) —
  correctly threw `TaskListChangedError` without further modifying the
  file, exactly as designed.

## Extension: real VS Code Extension Host

`npm run test:integration --workspace openspec-ui-vscode` — a genuine
`@vscode/test-electron` run, not a mock — 6/6 passing, including
"activates and registers all contributed commands," confirming the
extension activates cleanly with `openspec-ui.revealTask`/
`openspec-ui.deleteTask` registered and the tree providers wired, with
no runtime errors in a real VS Code instance.

## Not driven live: actual tree expansion / click-to-reveal / delete-via-UI

As with the two prior VS Code-UI-only changes this session
(`template-catalog-v2`'s delete, `extension-release-tagging`'s
customize-manifest fix), there is no desktop-app UI automation tool
available in this environment — can't literally click a task tree node
and watch the editor jump to it. Coverage for that interaction rests on:
33 passing `commands.test.ts` cases (including the line-fallback logic
for `revealTask` and the confirmation/archived-guard logic for
`deleteTask`, using a `vscode-mock.ts` extended specifically to model
`TextEditorRevealType`/`Selection`/a real `lineAt().text` for this
change) plus the real Extension Host activation check above.
