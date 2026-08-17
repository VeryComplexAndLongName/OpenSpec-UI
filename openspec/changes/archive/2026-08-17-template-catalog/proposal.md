## Why

`archive-tasks-as-template` (already shipped) only reuses tasks from a
*previously completed change in the same repository* — it has no way to
seed a change with a well-understood pattern that has never happened in
this repository before (e.g. "add SQLAlchemy models + Alembic
migrations" on a Python backend that has neither). This is a specific gap
raised in review of this repo's own OpenSpec dashboard: users currently
hand-write proposal/design/tasks from scratch for common, recurring
transformations every single time, with no reusable starting point beyond
their own repo's history. `docs/adr/0001-shared-core-two-delivery-targets.md`
decision #1 ("all business logic lives only in core; server/extension are
thin adapters") also already establishes the layering this change follows —
the catalog is core business logic, not something either host invents on
its own.

## What Changes

- Add a **built-in template catalog**: a fixed set of curated
  proposal/design/tasks starting points, shipped inside `@openspec-ui/core`
  as TypeScript modules (not loose files — see design.md, "Built-in
  templates ship as TS modules, not files on disk" — this matters for how
  the VS Code extension bundles). Read-only; not editable in place.
- Add a **project-level template layer**: `openspec/templates/<id>/`
  in the user's own repository (`template.json` manifest +
  `proposal.md`/`design.md`/`tasks.md`), created either by **customizing**
  a built-in entry (a fork, with a `forkedFrom: { id, version }` backlink
  to the built-in entry it came from) or listed as-is once such a folder
  exists. Fully user-editable, git-tracked with the rest of the project.
- Add a **render** operation: substitutes `{{variable}}` placeholders in a
  template's artifacts with user-supplied values, returning content the
  caller merges into its own state — no disk write, matching the
  non-destructive pattern `archive-tasks-as-template` already established.
- Standalone: a new "Templates" tab (browse built-in + project entries,
  customize a built-in one, insert a rendered template into a loaded
  change's Change Editor state).
- VS Code: a new "Templates" tree view (built-in + project sections) with
  "Customize" (built-in items) and "Insert into…" (any item, prompts for a
  non-archived target change and variable values, inserts via
  `WorkspaceEdit`) context-menu actions. `template.json` gets JSON Schema
  validation via `contributes.jsonValidation` — free autocomplete/errors in
  the native editor, no custom form needed there.
- One seed built-in entry to prove the mechanism end to end:
  "Add SQLAlchemy models + Alembic migrations" (Python).

## Capabilities

### New Capabilities

- `template-catalog`: built-in and project-level template storage,
  customize-with-backlink, variable rendering, and the browse/insert UI in
  both hosts.

### Modified Capabilities

(none — this does not change `change-editor-workbench`'s existing
requirements; it adds a new, separate source that feeds the same
non-destructive "insert into loaded change" pattern.)

## Impact

- `packages/core/src/template-catalog.ts`, `packages/core/src/templates/*.ts`
  (built-in registry).
- `packages/server/src/rest.ts` + `server.ts`: `/api/templates/list`,
  `/api/templates/customize`, `/api/templates/render`.
- `packages/webui/src/`: `template-catalog-client.ts`, a `Templates` tab in
  `standalone-entry.tsx` (added to `ALL_TABS`, not to
  `ALLOWED_TABS_VSCODE_EMBED` — same reasoning as the other four
  VS-Code-covered tabs in `standalone-shell-host-aware-tabs`).
- `packages/extension/src/tree/templates-tree.ts`, `commands.ts`,
  `package.json` (`contributes.views`/`commands`/`menus`/`jsonValidation`),
  a new JSON Schema file.
- No change to `execution-core` command/event protocol.
