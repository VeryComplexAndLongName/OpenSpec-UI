## 1. Extension: stable tree item ids

- [x] 1.1 `changes-tree.ts`: explicit `.id` on `ChangeTreeItem`
  (`change:<active|archived>:<changeName>`), `ArtifactTreeItem`
  (`artifact:<absolutePath>`), `EmptyTreeItem` (`empty:<label>`),
  `TaskTreeItem` (`task:<active|archived>:<changeName>:<lineNumber>`).
  Module-level comment explaining why every subclass here must set one.
- [x] 1.2 `templates-tree.ts`: same fix for `TemplateGroupTreeItem`
  (`template-group:<label>`), `TemplateTreeItem`
  (`template:<origin>:<manifestId>`, matching the key format already
  used in `standalone-entry.tsx`), `EmptyTemplatesTreeItem`
  (`empty-templates:<label>`) — same latent defect class, not yet
  reported but structurally identical (real nested collapsible groups,
  no ids anywhere).
- [x] 1.3 `changes-tree.test.ts`: id assertions on every existing test
  (root list, artifacts, tasks, empty/initialize item); new explicit
  regression assertion that a task's id differs from its parent
  Change's id. 5/5 passing.
- [x] 1.4 `archive-tree.test.ts`: same id assertions for the archived-
  change/task path. 3/3 passing.
- [x] 1.5 `templates-tree.test.ts`: id assertions for groups and leaf
  templates, plus a leaf-vs-parent-group distinctness check. 4/4
  passing.

## 2. Verification, versioning, and smoke test

- [x] 2.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/extension` (89/89). Re-run `npm run verify` after
  `git add`/commit of all new files.
- [x] 2.2 Bumped `package.json` version 0.12.1 → 0.12.2 (patch — bug
  fix, no contract change beyond the id-stability clarification) for
  `openspec-ui-vscode`. CHANGELOG entry, root `README.md` version table.
- [x] 2.3 Manual smoke test: real Extension Host run via
  `npm run test:integration`, 6/6 passing. `smoke-test-notes.md`
  explicitly discloses that the actual visual nesting/collapse behavior
  this fix targets still cannot be directly observed in this
  environment (no desktop-UI automation tool available) — the fix is
  grounded in VS Code's own documented `.id`-fallback behavior and
  verified indirectly via the id-distinctness unit tests, not a
  before/after screenshot.
- [x] 2.4 `openspec change validate --strict tree-item-stable-ids`
  passes.
