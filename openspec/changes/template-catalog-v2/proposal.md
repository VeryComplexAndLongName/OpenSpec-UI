## Why

`openspec/specs/template-catalog/spec.md`'s "Project-level templates live
in the user's repository" requirement says project templates are "fully
editable by the user through normal file editing" — but there is no way
to *remove* one through either delivery target once created, only
through manually deleting the directory outside the product. This is a
specific gap raised in review while dogfooding "Customize" for real:
after customizing `python-sqlalchemy-alembic` to try the feature, there
was no way to clean it back up from the VS Code tree or the standalone
Templates tab — a real, asymmetric CRUD gap (create/read/update via file
editing all exist, delete does not), not an intentional non-goal (the
original design.md's Non-Goals list covers "no create from scratch" and
"no auto-reconciliation," never delete).

Separately, the built-in catalog currently has exactly one seed template
(`python-sqlalchemy-alembic`) — a Python-only example, in a repository
whose own tooling is TypeScript/Node.js, and whose project-detection
scope (per this session's original brainstorm) explicitly names Python,
JavaScript, ASP.NET Core, and Node.js as target languages. Two more
patterns were already discussed and approved as good candidates
(Flask→FastAPI migration, flat→hexagonal architecture migration); this
proposal also adds a Node.js/TypeScript-oriented template so the catalog
is not exclusively Python.

## What Changes

- Add `deleteProjectTemplate(workspaceRoot, id)` to `packages/core` —
  removes `openspec/templates/<id>/` entirely. Built-in templates are
  code (`packages/core/src/templates/*.ts`), not deletable through this
  or any UI — this is explicitly project-level only, per review feedback.
- Expose it as `POST /api/templates/delete` (standalone) and a VS Code
  command `openspec-ui.deleteProjectTemplate`, scoped to
  `viewItem == openspec-ui.projectTemplate` only (the tree's built-in
  items never get a delete action). Both require an explicit confirm
  step before removing anything, matching `deleteChange`'s existing
  confirmation-modal pattern.
- Add three built-in templates: `flask-to-fastapi` (Python), a
  language-agnostic `flat-to-hexagonal-architecture`, and
  `node-vitest-testing-baseline` (Node.js/TypeScript) — registered in
  `packages/core/src/templates/index.ts` alongside the existing seed.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `template-catalog`: project-level templates can now be deleted through
  both delivery targets, not only created/edited/read; the built-in
  catalog grows from one seed template to four, covering more of the
  languages this product's own project-detection scope already names.

## Impact

- `packages/core/src/template-catalog.ts` (new function, new error
  class), `packages/core/src/templates/` (three new files + registry
  update).
- `packages/server/src/rest.ts`, `server.ts` (new endpoint).
- `packages/webui/src/template-catalog-client.ts` (new client function),
  `standalone-entry.tsx` (delete button, project templates only).
- `packages/extension/src/commands.ts`, `package.json` (new command +
  context-menu entry), `src/tree/templates-tree.ts` untouched (context
  value already distinguishes built-in vs. project).
- No change to the command/event protocol.
