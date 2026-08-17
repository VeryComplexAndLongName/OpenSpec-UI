## Context

`template-catalog.ts`'s `templateDir(workspaceRoot, id)` already guards
path construction with `assertValidTemplateId()` (`^[a-z0-9][a-z0-9-]*$`
— no `..`, no path separators), used by `customizeTemplate()` today.
`deleteProjectTemplate` reuses this exact helper rather than building a
second path — the same safety guarantee `customizeTemplate` already has
applies automatically, not by re-derivation.

Built-in templates are TypeScript modules in `packages/core/src/
templates/*.ts` (see `template-catalog`'s own earlier design.md,
"Built-in templates ship as TypeScript modules, not files on disk") —
there is no file on disk to delete for them even in principle; "delete"
only ever makes sense for the project-level, file-backed form.

## Goals / Non-Goals

**Goals:**
- Symmetric CRUD for project-level templates: create (customize),
  read (list), update (edit files directly, already true), delete (new).
- Both delivery targets get the same capability, matching every other
  templates action so far (Customize, Insert both work in standalone and
  VS Code).

**Non-Goals:**
- No delete action for built-in templates, anywhere — not exposed in
  either tree/tab's UI at all (see Decisions), not just disabled.
- No soft-delete/trash/undo. A project-level template is a plain
  directory of files a user already edits directly with no round-trip
  requirement (per `template-catalog`'s existing "editable by the user
  through normal file editing" requirement) — deleting it is exactly as
  reversible as deleting any other file the user manages themselves
  (i.e., via their own git history/editor undo, not a product-level
  trash can). Matches this repository's own stated philosophy that
  destructive actions get a confirm step, not an undo system, elsewhere
  (`deleteChange`).
- No new "are you sure" abstraction — reuses the existing
  `vscode.window.showWarningMessage(..., { modal: true }, "Delete")`
  pattern `deleteChange` already established, not a new confirmation
  component.

## Decisions

### Delete built-in templates is not offered at all, not merely disabled

Rejected showing a "Delete" action on built-in tree items that always
errors or is grayed out: built-in templates are code shipped with the
extension/server, not workspace data — offering a delete affordance that
can never do anything is confusing UI, not a safety feature. The existing
context-menu `"when": "viewItem == openspec-ui.projectTemplate"` pattern
(already used for `insertTemplateIntoChange`'s project-only half, and for
`copyTasksAsTemplate`) is reused verbatim for the new command — no new
`when`-clause vocabulary needed, `viewItem` already distinguishes the two
origins.

### `deleteProjectTemplate` reuses `templateDir()`, not a second lookup

Guarantees the exact same `assertValidTemplateId()` guard `customizeTemplate`
already relies on, and produces a clear, existing-shaped error
(`UnknownProjectTemplateError`, mirroring `UnknownBuiltInTemplateError`)
when the id has no matching directory — rather than a raw `ENOENT` from
`fs.rm` leaking through, which `sendJson` on the server side would report
as a generic 500, not the deliberate 404 every other
"resource not found" case in this API gets.

### Server responds 404 for an unknown project template, matching `customizeTemplate`'s 404 for an unknown built-in id

Consistent with the existing `handleTemplatesCustomizeRequest`'s
`UnknownBuiltInTemplateError → 404` mapping — the new delete endpoint
follows the identical shape (`UnknownProjectTemplateError → 404`) rather
than inventing a different status code for a symmetric "not found" case.

### New built-in templates: one language-agnostic, two language-specific

`flat-to-hexagonal-architecture` is written without assuming a source
language (the original brainstorm explicitly asked "independent of
language, or dependent?" — answered here as independent: the proposal/
design/tasks content describes layering and dependency-direction changes
that apply the same way regardless of implementation language, with
inline fill-in markers for language-specific file paths, same convention
`python-sqlalchemy-alembic` already uses for project-specific blanks).
`flask-to-fastapi` and `node-vitest-testing-baseline` are deliberately
language/framework-specific, like the existing seed template — a
language-agnostic *and* fully concrete template for the same pattern
would need two content variants to stay actionable, which is unnecessary
complexity for a first example of this pattern.

## Risks / Trade-offs

- **[Risk]** `fs.rm(dir, { recursive: true })` permanently removes
  whatever a user has since edited into that directory — there is no
  recovery path from within the product. → **Mitigation**: accepted,
  same as Non-Goals states; mitigated by the existing modal confirmation
  step, and users are expected to have these files under their own git
  history like any other workspace content.
- **[Risk]** Three more built-in templates is more ongoing-accuracy
  surface to keep current as frameworks evolve (same risk already
  accepted for the seed template in `template-catalog`'s own design.md).
  → **Mitigation**: kept each deliberately narrow (a handful of
  well-established, version-stable steps), same scoping discipline as
  the seed template, not an attempt at a comprehensive guide.

## Migration Plan

- No data migration; purely additive (new function/endpoint/command,
  three new built-in template modules).
- Version bump (minor) for `@openspec-ui/core`, `@openspec-ui/server`,
  `@openspec-ui/webui`, `openspec-ui-vscode`.
- Rollback: revert the package changes together; no persisted state
  beyond project-level template directories a user explicitly created or
  deleted themselves.
