## Why

DW, on 2026-09-18, item 7 of their report: "Allow 'dependency' management
with a mouse click (e.g. add/remove blocked_by, follows, ...). Now I need
to modify the openspec.yaml file manually."

The editor already draws the relation. `vscode-extension`'s requirement
"The relation between changes is visible in the editor" is satisfied by
the Change Graph view, and its scenario "Reading the graph" says in as
many words that the view "offers no action that mutates a change". That
was the right call when the graph was new and every mutating command in
the tree carried Archive or Rollback beside it. It leaves the one edit a
reader of the graph actually wants - saying that this change waits on that
one - to a text editor, a file the reader has to find, and a key whose
accepted shapes are documented only in `parseChangeRelations`.

The cost of getting it wrong by hand is real. The relation gate
(`quality-gates`, "A stated relation between changes is verified, not
trusted") fails a relation naming a change that does not exist and fails a
set of relations that forms a cycle - but it fails at lint time, in CI,
after the author has moved on. Nothing catches either at the moment the
author types the id, and a typo in a change id reads exactly like a
relation on work that has not been created yet.

## What Changes

- **A relation can be added and removed from the row that shows it.** The
  Change Graph and the Changes view offer Add Relation and Remove Relation
  on a change's context menu; the reader picks the kind (`follows`,
  `supersedes`, `blocked_by`) and the change, from lists rather than by
  typing an id.
- **Core owns the file.** A new module reads and rewrites a change's
  `.openspec.yaml`, keeping every other key, every comment and the file's
  own line endings, and writing the shape `parseChangeRelations` already
  accepts.
- **The checks that were CI's happen at the edit.** An edit naming a
  change that does not exist, naming the change itself, or closing a cycle
  is refused with the reason, before the file is touched - the same rules
  the relation gate applies, applied where they can still be acted on.
- **The archive stays history.** A relation on an archived change is drawn
  and never edited: archiving is what makes the record final.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-core`: core can change a stated relation, and refuses an edit
  the relation gate would later fail.
- `vscode-extension`: the relation is edited where it is read, rather than
  only drawn.

## Impact

- **`packages/core`**: a new `src/change-relations-file.ts` with the text
  edit and the guarded write, beside `change-graph.ts` which keeps the
  reading; its test.
- **`packages/extension`**: two commands, their context-menu entries, the
  pickers they open, and a refresh of both views after a successful edit.
- **`packages/webui` and `packages/server`**: untouched. Neither reads the
  change graph today (`readChangeGraph` has no caller outside the
  extension), so there is no relation surface in the standalone shell for
  an edit to sit on. Stated as a non-goal in `design.md` rather than left
  to look like an oversight.
