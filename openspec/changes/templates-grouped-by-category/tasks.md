## 1. VS Code tree

- [x] 1.1 Add `TemplateCategoryGroupTreeItem` to `templates-tree.ts`.
- [x] 1.2 Change `TemplatesTreeProvider.getChildren` so expanding "Built-in"
  or "Project" returns category subgroups (alphabetically sorted by
  category name) instead of templates directly; expanding a category
  subgroup returns its templates.
- [x] 1.3 Update `templates-tree.test.ts` for the new three-level
  structure (origin group → category subgroup → template).

## 2. Standalone Templates tab

- [x] 2.1 Sort/group `allTemplates` by category in `standalone-entry.tsx`
  before rendering; insert a full-width subheader `<tr>` at each category
  boundary.
- [x] 2.2 `standalone-entry.tsx` has no dedicated unit test file (it is
  the app bootstrap, covered by manual smoke test per this project's
  established pattern — see `smoke-test-notes.md`); no test file to
  update here.

## 3. Spec + verification

- [x] 3.1 Add the `template-catalog` spec delta (grouping scenarios for
  both delivery targets).
- [x] 3.2 `openspec validate --strict templates-grouped-by-category`.
- [x] 3.3 typecheck/lint/test for `webui` + `extension`; real Extension
  Host smoke test confirming the three-level tree expands/collapses
  correctly against this repository's own template catalog.
