## Context

See `proposal.md - Why`. Reuses the exact non-destructive pattern already
shipped in `archive-tasks-as-template`: read-only source → render/copy →
caller merges into its own state → nothing touches disk until an explicit
user save. `change-editor-workbench`'s `readChangeEditorDocument`/
`saveChangeEditorDocument` remain the only thing that ever writes a real
change's files; this capability only ever *produces content* for that
existing flow (or, for project-level templates themselves, writes plain
files under `openspec/templates/`, which are not OpenSpec changes and
carry no conflict-safety requirement of their own — they're just files the
user edits directly, like any other file in their repo).

`packages/extension` bundles `extension.js`/`webview.js` with esbuild
(`packages/extension/scripts/build.mjs`); `@openspec-ui/core` has no build
step of its own (`"main": "src/index.ts"`, consumed as TS source directly
by both esbuild-bundled extension code and by `tsx`-run, unbundled server
code). Non-JS asset files under `packages/core/src/` are not part of that
bundle graph — esbuild only follows import statements — and no copy-step
adds them to the packaged `.vsix` (`packages/server/public/index.html` is
the one existing exception, and it needs an explicit `copyFile` in
`build.mjs` to get there).

## Goals / Non-Goals

**Goals:**
- Built-in templates work identically whether run from source (`tsx`,
  server) or from the packaged `.vsix` (VS Code).
- Project-level templates are plain, git-trackable files a user can edit
  with nothing but their editor — no required tool round-trip to modify
  them once created.
- "Customize" always produces a traceable link back to the built-in
  version it came from.

**Non-Goals:**
- No fingerprint-based project detection/matching (which built-in
  templates apply to which projects). Deferred — the manifest schema is
  not extended with fingerprint fields in this change; if that lands
  later, it is an additive schema change, not a rework of this one.
  Discussed with the user as an explicit "not now" scoping decision.
- No "create a project-level template from scratch" UI (only
  customize-from-built-in). A user can still hand-write
  `openspec/templates/<id>/template.json` + the three markdown files
  directly — the read side of this capability does not care how a
  project-level entry came to exist — but no wizard is added for it here.
- No automatic reconciliation between a forked project-level template and
  a later version of its built-in source. `forkedFrom` is informational
  provenance, not a live sync link.
- No smart merging when inserting a template's proposal/design/tasks into
  a change that already has content — same as `archive-tasks-as-template`,
  content is appended below existing content verbatim; reconciling
  duplicate sections is a manual editing step.

## Decisions

### Built-in templates ship as TypeScript modules, not files on disk

Each built-in template is a `.ts` file exporting a typed object
(`{ manifest, artifacts }`) with the three artifacts as template-literal
strings, registered in a `BUILT_IN_TEMPLATES` array in
`packages/core/src/templates/index.ts` — the same "typed registry" shape
already used for `AGENT_REGISTRY`. `listBuiltInTemplates()` just returns
that array; nothing is read from disk at runtime for built-ins.

Rejected alternative: loose `template.json`/`*.md` files under
`packages/core/src/templates/<id>/`, read via `fs.readFileSync` relative
to the module's own location. Works unmodified for the server (runs core's
real TS source, unbundled, so the files would physically be present next
to it) but silently breaks in the packaged VS Code extension — the shipped
`.vsix` only contains `dist/extension.js` (a single bundled file) and
`media/`, not `packages/core/src/templates/`. This would require adding
and *remembering to maintain* an explicit copy-step in
`packages/extension/scripts/build.mjs` (the `index.html` copy is already
this kind of fragile point — see this session's `static.ts` query-string
bug for a concrete example of exactly this class of "worked in one host,
silently didn't in the other" gap going unnoticed until a real smoke
test). TS-module built-ins make that entire failure mode structurally
impossible instead of relying on remembering a build step.

### Project-level storage: `openspec/templates/<id>/`, parallel to `changes/` and `specs/`

Mirrors the existing `openspec/changes/<id>/{proposal,design,tasks}.md`
shape exactly, plus a `template.json` manifest. Rejected a location
outside `openspec/` (e.g. a top-level `.templates/`): OpenSpec tooling,
`.gitignore` conventions, and this repo's own governance already anchor
everything project-specific-but-OpenSpec-related under `openspec/`; a
second root-level convention would be pure inconsistency for no benefit.

### Customize rejects an existing project-level id instead of overwriting or auto-suffixing

Rejected silently overwriting: destroys any edits already made to that
project-level template, with no warning — the same class of mistake
`change-editor-workbench`'s conflict-safe save already exists to prevent.
Rejected auto-suffixing (`X`, `X-2`, ...): produces an ambiguous "which one
is real" catalog with no clear action for the user to resolve it. A hard
rejection with a clear error is simplest and matches
`ArchivedChangeNotFoundError`'s existing error-signaling shape in
`readArchivedChangeTasksTemplate`.

### Variable substitution: plain `{{name}}` string replace, no templating engine

`render()` does a single regex pass per variable
(`content.replaceAll(\`{{${name}}}\`, String(value))`), only for
explicitly declared variables. Rejected pulling in a templating library
(Handlebars/Mustache/EJS): the actual requirement (fill named placeholders
with plain-text values) does not need conditionals, loops, or partials,
and a full templating engine both adds a dependency and widens the content
surface that could execute arbitrary template syntax pasted into a
project-level `.md` file. Rejected string values are inserted literally,
not run through Markdown or HTML escaping, since the destination is always
a `.md` file the user reviews before saving — consistent with this
repo's stated model that repository/template content is data, not
executable instructions for the UI.

### Missing variable leaves the placeholder visible instead of rendering empty

If a declared variable has no supplied value, `{{name}}` stays literally
in the output. Rejected substituting an empty string: an empty
substitution looks identical to "this section intentionally has no
content" in the rendered markdown preview, silently producing broken
prose; a visible `{{name}}` is an unmistakable, greppable signal that a
value is still needed before the artifact is usable.

### Templates tab/tree follow the same host-aware pattern as the five existing tabs

The standalone "Templates" tab is excluded from
`ALLOWED_TABS_VSCODE_EMBED` (see `standalone-shell-host-aware-tabs`) for
the same reason as the other four: VS Code gets its own native tree view
for the same capability, so the embedded browser shell should not
duplicate it. No new decision needed here — this just applies the existing
one to a sixth tab.

## Risks / Trade-offs

- **[Risk]** The single seed built-in template ("Add SQLAlchemy models +
  Alembic migrations") could be subtly wrong or go stale as those
  libraries evolve. → **Mitigation**: kept deliberately narrow (a few
  well-established, version-stable steps — Base/engine/session setup,
  `alembic init`, first revision), reviewed as ordinary code (it is code —
  a `.ts` module), and clearly a single seed example, not a claimed
  curated library — proposal.md says so explicitly.
- **[Risk]** `{{variable}}` syntax could collide with literal double-curly
  text a user legitimately wants in a template body. → **Mitigation**:
  accepted; only variable names actually declared in the manifest are
  substituted, so undeclared `{{...}}` text passes through untouched.
- **[Risk]** A customized project-level template silently drifts from its
  built-in source as the built-in evolves; `forkedFrom` does not warn
  about this. → **Mitigation**: explicitly out of scope (see Non-Goals);
  the backlink is provenance for a human to notice and act on, not an
  automated sync — consistent with how "duplicate as user snippet"-style
  features work elsewhere.

## Migration Plan

- No data migration; purely additive (`openspec/templates/` is a new,
  previously-unused directory; no existing directory's meaning changes).
- Version bump (minor) for `@openspec-ui/core`, `@openspec-ui/server`,
  `@openspec-ui/webui`, `openspec-ui-vscode` per `openspec/config.yaml`.
- Rollback: revert the four package changes together; no persisted state
  to unwind (nothing is auto-written to disk by this capability beyond a
  project-level `openspec/templates/<id>/` a user explicitly requested via
  "Customize").
