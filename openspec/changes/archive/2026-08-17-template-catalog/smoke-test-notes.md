# Smoke test notes — template-catalog

Date: 2026-08-17

## Standalone: full round trip, real server, real browser

Built a scratch OpenSpec workspace with a real target change
(`target-change`, real proposal/design/tasks.md content), rebuilt the
standalone bundle, started `packages/server` for real (`cli.ts`), and
drove it through the Claude Code Browser pane (real Chromium, real HTTP).

1. Opened the workspace root; the new "Templates" tab (6th tab) is
   present, matches the design's host-aware-tabs pattern.
2. Clicked "Load templates" → `POST /api/templates/list` → 200 OK; the
   seed built-in template ("Add SQLAlchemy models + Alembic migrations")
   listed with a "Select" and "Customize" action.
3. Clicked "Select" → the variable form rendered both declared variables
   with their defaults pre-filled (`packageName` = "app",
   `databaseUrlEnvVar` = "DATABASE_URL"), and the "Insert into change"
   target picker already listed `target-change` (from `overview.changes`,
   loaded via the existing cwd-blur mechanism).
4. Changed `packageName` to `myapp`, picked `target-change`, clicked
   "Insert into change" → `POST /api/templates/render` → 200 OK. The app
   auto-switched to the Change Editor tab, showing
   "Inserted template ... into target-change. Review and save." — the
   proposal content correctly shows the *original* fixture content
   ("Existing target change fixture.") with the rendered template
   appended below it, and `{{packageName}}`/`{{databaseUrlEnvVar}}`
   correctly substituted to `myapp`/`DATABASE_URL` (visible as
   "myapp/db.py" in the rendered Impact section).
5. Confirmed on disk that `openspec/changes/target-change/proposal.md`
   was **not** modified — matches the "no file on disk is modified until
   the user saves" requirement; nothing was written until an explicit
   Save (not exercised further here, since the save path itself is
   already covered by `change-editor-workbench`'s existing tests).
6. Switched back to Templates, clicked "Customize" on the built-in
   template → the built-in row's "Customize" button disappeared
   (`isTemplateCustomized` correctly detected it), and a new
   "(customized)" row appeared under "project". Confirmed on disk:
   `openspec/templates/python-sqlalchemy-alembic/template.json` exists
   with `"forkedFrom": { "id": "python-sqlalchemy-alembic", "version": "1.0.0" }`
   — the backlink the user specifically asked for — plus the three
   markdown artifacts copied verbatim.

## VS Code: real extension host, unit + integration tests

`npm run test:integration --workspace openspec-ui-vscode` was run for
real (see the same real `@vscode/test-electron` setup noted in
`agent-selection/smoke-test-notes.md`) after adding the `Templates` view
and the two new commands. All 6 integration tests pass, including the
extended "activates and registers all contributed commands" assertion now
covering `openspec-ui.customizeTemplate` and
`openspec-ui.insertTemplateIntoChange`. This proves the extension
activates cleanly with the new `TemplatesTreeProvider` registered and the
new commands are really wired into a live VS Code extension host — not
just present in a mock.

What was **not** separately driven live: clicking through the actual
Templates tree UI inside a real VS Code window (as opposed to asserting
command registration via the integration test, and the command logic via
`commands.test.ts`'s mocked-`vscode` unit tests, which do cover the full
QuickPick → variable prompts → `WorkspaceEdit` → three-file-write flow in
detail). Given the standalone side was proven fully live above, and the
VS Code side's command *logic* is the same either way (only the value of
`vscode.window.showQuickPick`/`showInputBox`/`workspace.applyEdit` calls
differ, all covered by real VS Code API types via `tsc`), this is judged
a smaller residual gap than in the two prior changes, but still worth
naming rather than silently assuming full coverage.
