## Why

`change-editor-workbench` spec already requires safe, conflict-checked
editing of a change's `tasks.md` (see "Users can edit change markdown
artifacts in-app"), but provides no way to start that checklist from a
previously completed one. Today the only way to reuse a proven task
breakdown from `openspec/changes/archive/` is to leave the tool and copy
raw markdown off disk by hand, bypassing the Change Editor entirely and
risking pasting stale/inconsistent content — the exact class of problem
"prevents partial saves and silent overwrites" already guards against for
in-app edits. This is a specific gap raised in review of this repo's own
OpenSpec dashboard: archived changes are read-only reference material with
no in-app path into a new change's planning artifacts.

## What Changes

- Add a core function that reads an archived change's `tasks.md` and
  returns it as a **template**: checkbox items are reset from `- [x]`/`- [X]`
  to `- [ ]` (the archived change's completion state is not meaningful for
  a new change); heading structure and task text are preserved verbatim.
  Only changes actually present in `openspec/changes/archive/` (per
  `discoverOpenSpecWorkspace`) are readable this way — arbitrary paths are
  rejected.
- Standalone Change Editor: add an archived-change picker to the "Tasks"
  editor tab that fetches this template over a new server endpoint and
  inserts it into the currently loaded (non-archived) change's tasks
  content, for the user to review, reconcile, and save through the
  existing conflict-checked save flow. No new content is written to disk
  until the user explicitly saves.
- VS Code extension: add a "Copy tasks as template into…" context-menu
  command on archived changes in the Archive tree view. The user picks a
  non-archived target change from a picker; the template is inserted into
  that change's open `tasks.md` document (undoable, via the standard text
  editor, not a silent file write) for the user to review and save with
  VS Code's own save.
- In both hosts, only non-archived changes are valid **targets**; archived
  changes remain read-only. Archived changes are valid **sources** in both
  hosts — reusing proven, completed task breakdowns is the point.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `change-editor-workbench`: adds a requirement that the standalone Change
  Editor can copy an archived change's tasks as a template into the tasks
  content of a loaded, non-archived change.
- `vscode-extension`: adds a requirement that the Archive tree view offers
  a "copy tasks as template" action into a non-archived target change.

## Impact

- `packages/core/src/`: new template-read function (see design.md), reusing
  `discoverOpenSpecWorkspace` for archived-change validation.
- `packages/server/src/rest.ts` + `server.ts`: new
  `/api/change-editor/archive-tasks-template` endpoint.
- `packages/webui/src/change-editor-client.ts`, `standalone-entry.tsx`: new
  client call, archived-change picker UI in the Tasks editor tab.
- `packages/extension/src/tree/archive-tree.ts`, `commands.ts`,
  `package.json` (`contributes.commands`/`menus`): new command and context
  menu entry.
- No change to `execution-core` command/event protocol.
