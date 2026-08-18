# Smoke test — tree-item-stable-ids

- Real Extension Host run (`npm run test:integration --workspace
  openspec-ui-vscode`): 6/6 passing, extension activates cleanly with
  the changed tree providers.
- Unit tests exercise the actual `.id` values `getChildren()` produces,
  including an explicit regression assertion that a task's id differs
  from its parent Change's id (the exact distinction VS Code needs to
  keep nesting/collapse state stable across refreshes).

**Known verification gap, disclosed rather than hidden:** the actual
visual symptom this fixes — tasks rendering flush with their parent
instead of nested, losing collapse/expand — cannot be directly observed
in this environment; there is no desktop-UI automation tool available to
drive a running VS Code window and take a screenshot, a limitation
already noted in this session's other tree-feature smoke tests
(`tasks-tree-expand/smoke-test-notes.md`,
`repo-bootstrap-tree-ui/smoke-test-notes.md`). The fix is grounded
directly in VS Code's own documented behavior (an omitted `TreeItem.id`
falls back to a label-derived identity that "cannot be kept stable" once
items are recreated across refreshes — exactly what every provider in
this codebase does on every `getChildren()` call) and verified indirectly
via the id-distinctness unit tests, not a before/after screenshot. If the
symptom persists after this change ships, that would mean the root cause
is something other than missing ids, and needs a fresh live report.
