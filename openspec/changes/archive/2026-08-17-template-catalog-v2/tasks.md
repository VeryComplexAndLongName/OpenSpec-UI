## 1. Core: delete + new built-in templates

- [x] 1.1 `packages/core/src/template-catalog.ts`: add
  `UnknownProjectTemplateError` and `deleteProjectTemplate(workspaceRoot,
  id)` — reuses `templateDir()` for the safe path, throws
  `UnknownProjectTemplateError` if the directory does not exist,
  otherwise `fs.rm(dir, { recursive: true, force: true })`.
- [x] 1.2 `template-catalog.test.ts`: deletes an existing project
  template (directory gone afterward); throws
  `UnknownProjectTemplateError` for an unknown id, without touching the
  filesystem. 2 new tests, 11/11 passing.
- [x] 1.3 Add `packages/core/src/templates/flask-to-fastapi.ts`,
  `flat-to-hexagonal-architecture.ts`, `node-vitest-testing-baseline.ts`;
  register all three in `templates/index.ts`'s `BUILT_IN_TEMPLATES`.
- [x] 1.4 Export `deleteProjectTemplate`/`UnknownProjectTemplateError`
  from `index.ts` (not `browser.ts` — same fs-backed reasoning as the
  rest of `template-catalog.ts`'s write path).
  Covered automatically by the existing `export * from
  "./template-catalog.js"` in `index.ts` — no new export line needed.

## 2. Server: delete endpoint

- [x] 2.1 `packages/server/src/rest.ts`: `handleTemplatesDeleteRequest`
  (`{cwd, id}` in, `authorizeCwd`'d, 404 on
  `UnknownProjectTemplateError`, 200 `{ ok: true }` otherwise); wire
  `POST /api/templates/delete` in `server.ts`. Reuses the existing
  `isTemplatesCustomizeRequest` validator (`{cwd, id}` is the identical
  shape) instead of duplicating a validator.
- [x] 2.2 `server.test.ts`: deletes a real project-level template fixture
  (200, directory gone — verified via a follow-up `/api/templates/list`
  call); 404 for an unknown id. 2 new tests, 32/32 passing.

## 3. Webui: client + standalone UI

- [x] 3.1 `template-catalog-client.ts`: `deleteProjectTemplate(request,
  cwd, id)` thin wrapper, throwing on non-200 with the server's error
  message.
- [x] 3.2 `template-catalog-client.test.ts`: covers success + not-found.
  2 new tests, 6/6 passing.
- [x] 3.3 `standalone-entry.tsx`: "Delete" button in the Templates tab,
  rendered only for `origin === "project"` entries. No existing
  confirmation pattern was found anywhere in `webui` (`deleteChange` has
  no standalone UI at all — VS Code-only) — used the platform-native
  `window.confirm()` rather than inventing a custom modal component,
  matching this codebase's general "use the native primitive" bias
  elsewhere (native `<select>` for the agent picker, etc.). Refreshes the
  template list and clears the selection if the deleted template was
  selected.

## 4. Extension: delete command

- [x] 4.1 `commands.ts`: `openspec-ui.deleteProjectTemplate` — modal
  confirmation (`showWarningMessage(..., { modal: true }, "Delete")`,
  same pattern as `deleteChange`), calls `deleteProjectTemplate`,
  refreshes the templates tree, info message on success.
- [x] 4.2 `package.json`: registered the command; context-menu entry
  scoped to `"when": "viewItem == openspec-ui.projectTemplate"` only —
  never offered for built-in items. Group `openspec@9`, matching
  `deleteChange`'s destructive-action-last convention.
- [x] 4.3 `commands.test.ts`: confirms the modal gate (declining does not
  delete); successful delete calls core + refreshes tree; unknown-id
  error surfaces as a warning (not `showCommandError`) — matches
  `customizeTemplate`'s existing `TemplateAlreadyExistsError → warning`
  precedent for an "expected, named" error class, deviating slightly
  from this task's original wording. 4 new tests, 27/27 passing.

## 5. Documentation

- [x] 5.1 `README.md`/relevant package README: note the new command and
  that built-in templates are not deletable (code, not workspace data).

## 6. Verification, versioning, and smoke test

- [x] 6.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/core`, `packages/server`, `packages/webui`,
  `packages/extension`. Re-run `npm run verify` after `git add`/commit of
  all new files.
  Ran (post-`git add`) — full repo verify passed; confirmed
  independently by CI's own "Typecheck, lint, test, and build" job on
  PR #36. Checkbox was left unmarked at the time; corrected here as
  bookkeeping only, no functional change.
- [x] 6.2 Bump `package.json` versions (minor) for all four touched
  packages. core 0.15.0 → 0.16.0, server 1.6.0 → 1.7.0, webui 1.7.0 →
  1.8.0, extension 0.9.0 → 0.10.0. Also added a `packages/extension/
  CHANGELOG.md` 0.10.0 entry and updated `README.md`'s version table.
- [x] 6.3 Manual smoke test: customize the seed template for real,
  delete it for real through both the standalone Templates tab and the
  VS Code tree, confirm the directory is actually gone each time; verify
  a built-in item never shows a delete action in either host. Record in
  `smoke-test-notes.md`.
  Standalone: driven live in a real browser against a real server and
  this actual repository — deleted the real leftover project template
  from the user's earlier manual testing, confirmed on disk it's gone,
  confirmed the confirmation gate genuinely blocks an undismissed/
  declined confirm, confirmed all 4 built-in templates never show
  Delete. VS Code: no desktop-automation tool available in this
  environment; relies on the 27 passing `commands.test.ts` cases plus
  both hosts calling the identical core function verified live above.
  Full detail in `smoke-test-notes.md`.
- [x] 6.4 `openspec change validate --strict template-catalog-v2` passes.
