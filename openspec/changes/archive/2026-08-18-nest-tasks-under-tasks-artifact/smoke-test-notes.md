# Smoke test — nest-tasks-under-tasks-artifact

- Real Extension Host run (`npm run test:integration --workspace
  openspec-ui-vscode`): **7/7 passing**, including a new live test
  ("Changes tree: tasks.md's checklist items nest under the Tasks
  artifact, not flat under the Change") that drives the actual
  registered `ChangesTreeProvider` (via a new test-only
  `ExtensionTestApi.changesTree` export) against the suite's real
  fixture workspace (`openspec/changes/demo/tasks.md`, with a real
  checklist item), two `getChildren()` calls deep — not a mocked
  `vscode` module.
- This test genuinely caught a real mistake on its first run: it failed
  because the assertion string was missing the fixture's trailing
  period ("1.1 Placeholder task." vs "1.1 Placeholder task") — direct
  evidence the test actually exercises the real code path and isn't
  trivially green.
- Confirmed live, via `discoverOpenSpecWorkspace` run through `tsx`
  against a real temp workspace, that the real `WorkbenchArtifact[]`
  core hands the extension does contain `{kind: "tasks", label:
  "Tasks", exists: true}` — the exact shape `getChangeChildren`'s new
  branch depends on, not an assumption baked only into test fixtures.
- Full `npm run test` (99/99) and `npm run lint` clean for
  `packages/extension`.

## Why this change exists despite `tree-item-stable-ids` already "fixing" the same bug report

That change (`openspec/changes/archive/2026-08-18-tree-item-stable-ids`)
found and fixed a real, separate defect — missing stable `.id` on tree
items — but it was diagnosed from the bug report without a structural,
live check of the actual tree shape, only unit tests against a mocked
`vscode` module asserting `getChildren()` *return values* were
well-formed. Those tests passed, the fix shipped, and the user reported
the exact same visible symptom afterward: it was never the actual
cause. This change is the real fix, verified this time by literally
walking the tree two levels deep in a real Extension Host and asserting
task items are absent at the Change level and present only under
"Tasks" — the check that should have existed from the start.
