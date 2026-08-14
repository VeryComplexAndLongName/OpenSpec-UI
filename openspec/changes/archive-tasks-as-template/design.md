## Context

`packages/core/src/change-editor-store.ts` already implements
conflict-safe read/save for a *non-archived* change's four artifacts
(`readChangeEditorDocument`/`saveChangeEditorDocument`), resolving paths as
`openspec/changes/<changeName>/...`. It cannot address archived changes —
their real path is `openspec/changes/archive/<changeName>/...` — which is
why archived changes are read-only today. `packages/core/src/workbench.ts`'s
`discoverOpenSpecWorkspace(root)` already separately enumerates
`archivedChanges: WorkbenchChange[]` (each with `.path` and an
`artifacts[]` list including a `tasks` entry), and is the module
`archive-tree.ts` already uses to render the Archive tree. See
`proposal.md - Why` for the motivation.

Checkbox format is `- [ ]` / `- [x]` / `- [X]` (confirmed by
`packages/core/src/change-state.test.ts` fixtures).

## Goals / Non-Goals

**Goals:**
- Provide one core function that turns an archived change's `tasks.md`
  into a template (checkboxes reset), validated against the actual archive
  listing so arbitrary file reads are impossible.
- Wire that function into both hosts using each host's existing transport
  convention (HTTP for standalone, direct import for the extension) rather
  than inventing a third pattern.
- Keep the "insert" step non-destructive and reviewable: text lands where
  the user can edit and explicitly save/discard it, in both hosts.

**Non-Goals:**
- No automatic renumbering or merging of task groups (e.g. reconciling two
  "## 1. Setup" headings if both source and target have one). The template
  is inserted verbatim below existing content; reconciling numbering is a
  manual editing step, same as pasting text today, just sourced correctly
  and safely.
- Not extending this to Proposal/Design/Spec artifacts. Those are prose
  tied to their own change's specific rationale and delta semantics (a
  spec delta is meaningless copied out of context); only the tasks
  checklist is structurally reusable across changes. A future change can
  revisit this if a concrete need appears.
- Not adding a way to copy tasks *from* a non-archived change, or *into* an
  archived one. Sources are archive-only (proven, completed work);
  targets are non-archive-only (per `change-editor-workbench`'s existing
  "non-archived" constraint on editing).

## Decisions

### Core: one read-only template function, not a generic archive-file-read API

Add `readArchivedChangeTasksTemplate(workspaceRoot, changeName)` to
`packages/core/src/` (e.g. new `task-templates.ts`, alongside
`change-editor-store.ts`). It calls `discoverOpenSpecWorkspace(workspaceRoot)`,
finds `changeName` in `archivedChanges`, reads that entry's `tasks` artifact
file, applies the checkbox-reset transform
(`content.replace(/-\s\[[xX]\]/g, "- [ ]")`), and returns the string. It
throws if `changeName` is not present in `archivedChanges` — the archive
listing is the allowlist, not string path-building from user input.

Rejected alternative: a generic "read any file under an archived change"
endpoint parameterized by artifact key — rejected as unnecessary surface
area; only `tasks.md` has a demonstrated reuse case (see Non-Goals), and a
generic reader would need the same per-artifact justification this
proposal deliberately doesn't make for proposal/design/spec.

### Standalone: new REST endpoint, client-side insert, existing save flow

`POST /api/change-editor/archive-tasks-template` `{ cwd, changeName }` →
`{ template: string }`, added next to the existing
`/api/change-editor/*` handlers in `server.ts`/`rest.ts`. The webui side
adds `loadArchivedTasksTemplate` to `change-editor-client.ts` and a small
picker UI in the Change Editor's Tasks sub-tab (visible only when
`editorTab === "tasks"` and a target change is loaded) that lists archived
changes (a new small overview field or a lightweight
`/api/archive/list`-style addition — reusing `discoverOpenSpecWorkspace`
server-side the same way `archive-tree.ts` does client-side) and an
"Insert as template" button. Clicking it appends the fetched template to
`editorFiles.tasks` in React state only; the existing `handleSaveEditor` /
`saveChangeEditorDocument` conflict-checked flow is unchanged and is what
actually writes to disk.

Rejected alternative: a combined "read archived tasks and write them
directly into the target's tasks.md on the server" endpoint — rejected
because it bypasses the revision-conflict check `change-editor-workbench`
already requires for every write, and denies the user a chance to edit the
merged result before it lands on disk.

### VS Code: direct core import, insert via `TextEdit`, not `fs.writeFile`

New command `openspec-ui.copyTasksAsTemplate`, registered like the
existing `unarchiveChange`/`archiveChange` commands in `commands.ts`,
context-menu-bound to `ChangeTreeItem` with `contextValue ==
openspec-ui.archivedChange` (mirrors the existing `unarchiveChange` menu
binding in `package.json`). Handler: `vscode.window.showQuickPick` over
`workspace.changes` (non-archived, from `ChangesTreeProvider`'s same
`discoverOpenSpecWorkspace` call) for the target; calls
`readArchivedChangeTasksTemplate` directly (no HTTP, per ADR-0001 decision
#2's extension default); opens the target's `tasks.md` via
`vscode.workspace.openTextDocument` + `vscode.window.showTextDocument`;
inserts the template at end-of-document using a `vscode.TextEdit`/
`WorkspaceEdit` (`vscode.workspace.applyEdit`), not `fs.writeFile` directly
— this respects an already-open, possibly-dirty editor for that file,
appears in VS Code's own undo stack, and leaves the document unsaved until
the user saves it natively.

Rejected alternative: direct `fs.writeFile` of the merged content —
rejected because it silently overwrites/ignores unsaved editor state for
that file and does not integrate with VS Code's undo/save affordances,
inconsistent with "no partial saves/silent overwrites" already required of
`change-editor-workbench`.

## Risks / Trade-offs

- **[Risk]** Appending verbatim can produce two colliding `## 1. ...`
  headings if source and target both start numbering at 1. → **Mitigation**:
  explicitly a Non-Goal (see above); the Change Editor's live markdown
  preview and VS Code's own editor make the resulting duplication visible
  and easy to renumber by hand before saving.
- **[Risk]** A large archive could make a flat archived-changes picker
  unwieldy. → **Mitigation**: out of scope for this change; the same
  scaling question already applies to `ArchiveList`'s existing name search
  (see this repo's earlier discussion of a global search capability) and
  is not new to this feature.
- **[Risk]** Path-traversal via a crafted `changeName` reading files
  outside the archive. → **Mitigation**: `readArchivedChangeTasksTemplate`
  only reads paths returned by `discoverOpenSpecWorkspace`'s
  `archivedChanges`, never a path built directly from the request/command
  input — covered by task 1.2's test.

## Migration Plan

- No data migration. Additive REST endpoint and additive VS Code command;
  no existing endpoint or command changes behavior.
- Version bump (minor) for `packages/core`, `packages/server`,
  `packages/webui`, `packages/extension` per `openspec/config.yaml`.
- Rollback: revert the four package changes together; no persisted state
  to unwind since nothing is auto-written to disk by the new code paths.
