## 1. Core: types, built-in registry, and template operations

- [x] 1.1 Add `TemplateVariable`, `TemplateManifest`, `TemplateArtifacts`,
  `CatalogTemplate` types to a new `packages/core/src/template-catalog.ts`.
- [x] 1.2 Add one seed built-in template,
  `packages/core/src/templates/python-sqlalchemy-alembic.ts`
  ("Add SQLAlchemy models + Alembic migrations"), exporting
  `{ manifest, artifacts }`; register it in
  `packages/core/src/templates/index.ts`'s `BUILT_IN_TEMPLATES` array.
- [x] 1.3 Add `listBuiltInTemplates()` (returns `BUILT_IN_TEMPLATES` as
  `CatalogTemplate[]` with `origin: "built-in"`).
- [x] 1.4 Add `listProjectTemplates(workspaceRoot)`: reads
  `openspec/templates/*/template.json` + the three markdown files,
  `origin: "project"`. Invalid/missing manifests are skipped, not thrown.
- [x] 1.5 Add `customizeTemplate(workspaceRoot, builtInId)`: writes
  `openspec/templates/<builtInId>/` with `forkedFrom: { id, version }` set
  from the built-in entry's own id/version; throws
  `TemplateAlreadyExistsError` if the target directory already exists.
- [x] 1.6 Add `renderTemplate(template, variables)`: substitutes
  `{{name}}` per declared variable across all three artifacts; leaves
  undeclared-or-unsupplied placeholders untouched.
- [x] 1.7 Export all of the above from `packages/core/src/index.ts`.
  Also re-exported the four types (not the fs-backed functions) from
  `browser.ts` — needed so `webui`'s browser bundle can type the client
  functions/UI without pulling in `node:fs`.
- [x] 1.8 Add `template-catalog.test.ts`: built-in listing includes the
  seed entry; project listing reads real files from a temp workspace and
  skips an invalid manifest; customize writes the correct `forkedFrom` and
  rejects an existing id; render substitutes declared variables and leaves
  an omitted one as `{{name}}`. 9 tests, all passing.

## 2. Server: REST endpoints

- [x] 2.1 Add `handleTemplatesListRequest`
  (`POST /api/templates/list` `{ cwd }` →
  `{ builtIn: CatalogTemplate[], project: CatalogTemplate[] }`),
  `handleTemplatesCustomizeRequest`
  (`POST /api/templates/customize` `{ cwd, id }` → the created
  `CatalogTemplate`, 409 on `TemplateAlreadyExistsError`), and
  `handleTemplatesRenderRequest`
  (`POST /api/templates/render` `{ cwd, origin, id, variables }` →
  `{ proposal, design, tasks }`) in `packages/server/src/rest.ts`; wire all
  three into `server.ts`.
- [x] 2.2 Add `server.test.ts` cases: list returns the seed built-in plus a
  real project-level fixture; customize succeeds then 409s on retry;
  render substitutes a variable end to end over HTTP.

## 3. Standalone: Templates tab

- [x] 3.1 Add `template-catalog-client.ts` to `packages/webui/src/`:
  `listTemplates`, `customizeTemplate`, `renderTemplate` thin fetch
  wrappers, mirroring `change-editor-client.ts`'s shape.
- [x] 3.2 Add `"templates"` to `ALL_TABS` in `host-embed.ts` (label
  "Templates"), left out of `ALLOWED_TABS_VSCODE_EMBED`.
- [x] 3.3 Add the Templates `TabPanel` to `standalone-entry.tsx`: a table
  (built-in + project, with a "customized" badge showing `forkedFrom` when
  present), a detail view with a variables form and a "Customize" button
  (built-in items only, disabled once already customized), and an
  "Insert into…" flow — pick a non-archived change from `overview.changes`,
  render, load that change into the Change Editor state (reusing
  `loadChangeEditor`), merge the three rendered fields into `editorFiles`
  via `mergeTasksTemplate` (already generic enough for all three), and
  switch `activeTab` to `"change-editor"` so the user lands on the result
  to review before saving.
- [x] 3.4 Add tests: `template-catalog-client.test.ts` for the three fetch
  wrappers; a `Tabs`-level test asserting `"templates"` is absent from the
  VS Code embed tab set (extends the existing `host-embed.test.ts`
  coverage pattern).
  Also updated `Tabs.test.tsx`'s "renders all five tabs" test to six, and
  added an explicit "excludes the Templates tab from the VS Code
  local-server embed" test.

## 4. VS Code: Templates tree and commands

- [x] 4.1 Add `packages/extension/src/tree/templates-tree.ts`
  (`TemplatesTreeProvider`): a "Built-in" group and a "Project" group,
  each listing `CatalogTemplate` entries via direct core import
  (`listBuiltInTemplates`/`listProjectTemplates`); built-in items get
  `contextValue = "openspec-ui.builtInTemplate"`, project items
  `"openspec-ui.projectTemplate"`.
- [x] 4.2 Register `openspecUiTemplates` view under the `openspec-ui`
  container in `package.json` `contributes.views`, and wire the provider
  in `extension.ts` alongside the existing tree providers.
- [x] 4.3 Register `openspec-ui.customizeTemplate` (built-in items only:
  calls `customizeTemplate` directly, refreshes the tree, reports the
  409 case via `showWarningMessage`) and
  `openspec-ui.insertTemplateIntoChange` (any item: `pickChange` for the
  target — reusing the existing helper — sequential `showInputBox`/
  `showQuickPick` prompts for each declared variable, `renderTemplate`
  directly, then a `WorkspaceEdit` appending to the target's
  proposal.md/design.md/tasks.md, followed by `showTextDocument` on
  tasks.md) in `commands.ts`.
- [x] 4.4 Add `contributes.commands`/`view/item/context` menu entries
  (mirroring the `copyTasksAsTemplate` wiring from `archive-tasks-as-template`)
  scoped to the two new context values.
- [x] 4.5 Add `packages/extension/schemas/template.schema.json` (JSON
  Schema for the manifest: `id`/`title`/`category`/`version`/`summary`
  required strings, `variables` array, optional `forkedFrom` object) and
  register it via `contributes.jsonValidation` for
  `openspec/templates/*/template.json`.
- [x] 4.6 Add/extend `commands.test.ts` and `templates-tree.test.ts`
  covering: tree grouping, customize success + 409 case, insert-into-change
  variable prompting and `WorkspaceEdit` content, extending
  `test-utils/vscode-mock.ts` only if the existing document-store mock
  from `archive-tasks-as-template` is insufficient for multi-file inserts
  (writing to three files, not one).
  The existing single-file document-store mock turned out sufficient
  unmodified — each of the three files is a separate map entry keyed by
  its own path, and `insertTemplateIntoChange` reads/writes each in turn.
  Also added a boolean-variable QuickPick test beyond what was listed.
  Verified for real against a live `@vscode/test-electron` instance (see
  `smoke-test-notes.md`) — extension activates with the new view and both
  commands are really registered.

## 5. Verification, versioning, and smoke test

- [x] 5.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/core`, `packages/server`, `packages/webui`,
  `packages/extension`. 333 tests total across all four packages, plus
  the English-policy check.
- [x] 5.2 Bump `package.json` versions (minor) for all four touched
  packages per `openspec/config.yaml`.
  core 0.13.0 → 0.14.0, server 1.4.0 → 1.5.0, webui 1.5.0 → 1.6.0,
  extension 0.7.0 → 0.8.0.
- [x] 5.3 Manual smoke test in both hosts on a real scratch workspace:
  (a) standalone — list templates, customize the seed built-in, insert it
  (rendered, variables filled) into a change, confirm Change Editor shows
  the merged content and nothing is written to disk before Save;
  (b) VS Code — same flow through the Templates tree and
  `insertTemplateIntoChange`, confirm `template.json` gets schema
  validation in the editor. Record results in `smoke-test-notes.md`,
  including any gap that could not be run in this environment (see the
  two prior changes' notes for the established format).
  (a) fully exercised live in a real browser against a real server —
  list, select (variable form + prefilled defaults), insert (rendered,
  merged into an existing change's Change Editor state, disk untouched
  until save), and customize (backlink verified on disk) all confirmed.
  (b) extension activation + command registration confirmed live via
  `test:integration`; the tree click-through itself was not separately
  driven — see `smoke-test-notes.md` for the full reasoning.
- [x] 5.4 `openspec change validate --strict template-catalog` passes.
