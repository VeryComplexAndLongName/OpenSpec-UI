## 1. Core: template read function

- [x] 1.1 Add `readArchivedChangeTasksTemplate(workspaceRoot, changeName)`
  to a new `packages/core/src/task-templates.ts`, using
  `discoverOpenSpecWorkspace` to locate and validate the archived change
  and its `tasks` artifact path.
- [x] 1.2 Add `task-templates.test.ts`: covers checkbox reset (`- [x]`,
  `- [X]` → `- [ ]`, `- [ ]` unchanged), heading/text preserved verbatim,
  and rejection (thrown error) when `changeName` is not present in
  `archivedChanges` — including a path-traversal-style name (e.g.
  `../../etc`) to confirm it is rejected the same way.

## 2. Server: REST endpoint

- [x] 2.1 Add `handleArchiveTasksTemplateRequest` in
  `packages/server/src/rest.ts` for
  `POST /api/change-editor/archive-tasks-template` `{ cwd, changeName }` →
  `{ template: string }` (404/400 on invalid `changeName`, matching the
  existing `/api/change-editor/*` error conventions), wired into
  `server.ts`.
- [x] 2.2 Add a server test in `server.test.ts` for the new endpoint:
  success case and invalid-archived-name case.
  Also extended `/api/overview` with an `archivedChanges: string[]` field
  (via `discoverOpenSpecWorkspace`, independent of the `listChanges` CLI
  wrapper which never returns archived changes) — needed so the standalone
  Change Editor picker (task 3.2) has a source list to populate from; not
  its own numbered task in the original breakdown, folded into this one.
  Covered by a new `server.test.ts` case
  ("lists archived change names in the overview...").

## 3. Standalone: Change Editor UI

- [x] 3.1 Add `loadArchivedTasksTemplate(request, cwd, changeName)` to
  `packages/webui/src/change-editor-client.ts`.
- [x] 3.2 Add an archived-change picker + "Insert as template" control to
  the Tasks sub-tab of the Change Editor section in
  `packages/webui/src/standalone-entry.tsx`, listing archived changes
  (server-side reuse of `discoverOpenSpecWorkspace`, exposed the same way
  `archive-tree.ts` already consumes it) and appending the fetched
  template to `editorFiles.tasks` in local state only.
  Archived-changes source is `overview.archivedChanges` (see 2.2). Merge
  logic extracted as a pure `mergeTasksTemplate` helper in
  `change-editor-client.ts` rather than inlined, for testability.
- [x] 3.3 Add a test asserting: clicking "Insert as template" updates the
  Tasks textarea content and does not call the save endpoint by itself.
  `standalone-entry.tsx` cannot itself be imported in tests (mounts to
  `#root` as a side effect on import — same constraint noted in the
  `standalone-shell-host-aware-tabs` change). Covered instead by
  `change-editor-client.test.ts` (`loadArchivedTasksTemplate` request
  shape + `mergeTasksTemplate` merge behavior, which together are exactly
  what the click handler does) and confirmed end-to-end in a real browser
  against a real server in task 5.3 (network tab showed no `save` call,
  disk file unchanged after insert).

## 4. VS Code: Archive tree command

- [x] 4.1 Register `openspec-ui.copyTasksAsTemplate` in
  `packages/extension/src/commands.ts` (pattern: mirror
  `unarchiveChange`'s registration), reading the archived change via
  `readArchivedChangeTasksTemplate` (direct core import) and prompting a
  `vscode.window.showQuickPick` of `workspace.changes` (non-archived) for
  the target — reporting "no valid target" via
  `vscode.window.showInformationMessage` when that list is empty, per the
  "No non-archived changes exist" scenario.
  Reused the existing `pickChange(workspaceRoot)` helper (already used by
  `openspec-ui.status`/etc.) instead of writing a new picker — it already
  lists non-archived changes and already reports
  "no changes found in openspec/changes/." via `showWarningMessage` when
  empty, which satisfies the same scenario without a second message/API.
- [x] 4.2 Implement the insert as a `vscode.WorkspaceEdit` appending the
  template to the end of the target's opened `tasks.md` document (not
  `fs.writeFile`), then reveal the document via
  `vscode.window.showTextDocument`.
- [x] 4.3 Add `"openspec-ui.copyTasksAsTemplate"` to
  `packages/extension/package.json` `contributes.commands`, and a
  `view/item/context` menu entry scoped to
  `viewItem == openspec-ui.archivedChange` (mirroring the existing
  `unarchiveChange` menu entry).
- [x] 4.4 Add/extend a `commands.test.ts` case covering: QuickPick target
  selection, template insertion via `WorkspaceEdit`, and the empty-target
  case.
  Extended `test-utils/vscode-mock.ts` with a `WorkspaceEdit` class and an
  in-memory document store backing `workspace.openTextDocument(uri)` /
  `workspace.applyEdit`, so the test can assert on actual resulting
  document content, not just that mocks were called. Also added a
  non-archived-source no-op case and a dismissed-picker no-op case beyond
  what was listed.

## 5. Verification and versioning

- [x] 5.1 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/core`, `packages/server`, `packages/webui`,
  `packages/extension`.
- [x] 5.2 Bump `package.json` versions (minor) for all four touched
  packages per `openspec/config.yaml` versioning rules.
  core 0.11.1 → 0.12.0, server 1.2.4 → 1.3.0 (continuing from the patch
  bump already made in `standalone-shell-host-aware-tabs`), webui 1.3.0 →
  1.4.0, extension 0.5.0 → 0.6.0 (same continuation).
- [x] 5.3 Manual smoke test in both hosts: (a) standalone — insert a
  template from a real archived change into a draft change's Tasks tab,
  confirm no disk write until Save; (b) VS Code Extension Development Host
  — run "Copy tasks as template into…" from the Archive tree, confirm the
  target's `tasks.md` opens with the inserted, unchecked template and is
  undoable. Record results in `smoke-test-notes.md` in this change
  directory.
  See `smoke-test-notes.md`: (a) verified live in a real browser against a
  real running server on a scratch OpenSpec workspace — passes, including
  confirming the target file is untouched on disk until Save. (b) **not**
  performed — no interactive VS Code available in this environment, same
  gap as the sibling change; covered instead by `commands.test.ts` plus a
  real `tsc` check against `@types/vscode`. Flagged explicitly, not
  claimed as done.
- [x] 5.4 `openspec change validate --strict archive-tasks-as-template`
  passes.
