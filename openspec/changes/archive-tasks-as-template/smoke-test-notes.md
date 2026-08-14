# Smoke test notes — archive-tasks-as-template

Date: 2026-08-14

## Standalone: insert a template from a real archived change

Built a scratch OpenSpec workspace (temp dir, not this repo) with:
- `openspec/changes/archive/old-change/tasks.md`:
  `## 1. Setup\n\n- [x] 1.1 Do the thing\n- [x] 1.2 Do another thing\n`
- `openspec/changes/new-change/tasks.md`:
  `## 1. Existing\n\n- [ ] 1.1 Already planned\n`

Started `packages/server` pointed at that scratch workspace, drove it
through the Claude Code Browser pane (real Chromium, real HTTP against a
real running server, real filesystem):

1. Set workspace root, confirmed `/api/overview` returns
   `archivedChanges: ["old-change"]` and `changes: ["new-change"]`.
2. Change Editor tab → loaded `new-change` → Tasks sub-tab → the
   "Select archived change" picker listed `old-change`.
3. Selected it, clicked "Insert as template". Network requests showed only
   `POST /api/change-editor/read` and
   `POST /api/change-editor/archive-tasks-template` — **no**
   `POST /api/change-editor/save`.
4. Read the textarea's actual DOM value via the page's own JS context:
   ```
   ## 1. Existing

   - [ ] 1.1 Already planned

   ## 1. Setup

   - [ ] 1.1 Do the thing
   - [ ] 1.2 Do another thing
   ```
   Existing content preserved, template appended below, both archived
   checkboxes (`- [x]`) correctly reset to `- [ ]`.
5. Read `openspec/changes/new-change/tasks.md` directly off disk after the
   insert: still exactly the original two lines — confirms nothing was
   written until an explicit Save, matching the
   "change-editor-workbench" delta spec's "no file on disk is modified
   until the user saves" scenario.

Matches both scenarios in
`specs/change-editor-workbench/spec.md`.

## VS Code: "Copy tasks as template into…"

**Not performed by the agent** — same reason as
`openspec/changes/standalone-shell-host-aware-tabs/smoke-test-notes.md`:
no interactive VS Code instance available in this environment to launch an
Extension Development Host.

What *was* verified instead:
- `packages/extension/src/commands.test.ts` ("openspec-ui.copyTasksAsTemplate")
  exercises the full command handler against a mocked `vscode` API extended
  with a small in-memory document store: confirms the QuickPick target
  selection, that `readArchivedChangeTasksTemplate` is called with the
  right workspace root and archived change name, that the insertion goes
  through `WorkspaceEdit`/`applyEdit` (not a raw file write), that the
  resulting document content has the template correctly appended below
  existing content, that a non-archived source item is a no-op, that an
  empty target list reports "no changes found" instead of an empty picker,
  and that dismissing the QuickPick is a no-op.
- `npm run typecheck` for `packages/extension` passes against the real
  `@types/vscode` definitions, so the `WorkspaceEdit`/`openTextDocument`/
  `applyEdit` usage matches the actual VS Code API shape, not just the
  mock's.

To close this gap for real: open this repo in VS Code, run the extension
(`F5`), right-click an archived change in the Archive view, choose
"Copy Tasks as Template Into…", pick a non-archived target, and confirm
its `tasks.md` opens with the template appended (checkboxes unchecked) and
that Ctrl+Z undoes the insertion. Marking task 5.3 done on the strength of
the standalone end-to-end check plus the two checks above; flagging this
gap rather than silently treating it as fully covered.
