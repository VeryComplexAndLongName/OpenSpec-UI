# Smoke test — templates-grouped-by-category

- Real Extension Host run (`npm run test:integration --workspace
  openspec-ui-vscode`): **8/8 passing**, including a new live test
  ("Templates tree: built-in templates are grouped by category, not
  flat under Built-in") that drives the actual registered
  `TemplatesTreeProvider` (via a new test-only
  `ExtensionTestApi.templatesTree` export) against this extension's
  real, static built-in template catalog — not a mocked `vscode`
  module or a fixture. It confirms: expanding "Built-in" returns only
  category subgroups (`openspec-ui.templateCategoryGroup`, sorted
  alphabetically, never a template directly); expanding the "testing"
  subgroup returns only templates with `openspec-ui.builtInTemplate`,
  including the existing Vitest testing-baseline template by its exact
  title.
- Test deliberately asserts against the "testing" category / Vitest
  template (present on `main` already), not the new categories/
  templates added in the separate `feat/template-catalog-v3-agent-
  relevant-templates` branch — this change's live coverage does not
  depend on merge order between the two branches.
- Full `npm run test` clean for `packages/extension` (100/100) and
  `packages/webui` (112/112); `npm run typecheck`/`lint` clean for
  both.
- webui Templates table grouping (`standalone-entry.tsx`) has no
  dedicated unit test (the file is the app bootstrap, not unit-tested
  directly per this project's established pattern) — verified by
  reading the rendered JSX logic and confirming `npm run typecheck`
  catches the `Fragment`/`colSpan` JSX shape; no live browser smoke
  test performed for this specific change.
