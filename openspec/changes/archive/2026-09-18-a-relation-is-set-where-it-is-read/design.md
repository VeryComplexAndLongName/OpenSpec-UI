## Context

`packages/core/src/change-graph.ts` reads every change's `.openspec.yaml`
and answers what follows what (`readChangeGraph`), what forms a cycle
(`findChangeGraphCycles`), what waits on something still active
(`findUnmetBlockers`) and what the gate rejects (`checkChangeGraph`).
Nothing writes. The extension's Change Graph view draws the result, and
`packages/extension/src/tree/change-graph-tree.ts` is its only consumer.

The file itself is not YAML in practice. `parseChangeRelations` is a
line-based parser that accepts a flow sequence (`follows: [a, b]`), a
single scalar (`follows: a`) and a block sequence, ignores comments, and
reports a key that does not start its own line as an error rather than
silently reading it as absent. It carries other keys too - `schema`,
`created`, and whatever a workspace has added.

## Goals

- A relation is added and removed from the row that shows it, with no id
  typed by hand.
- The rules the relation gate applies at lint time are applied at the
  edit, with the reason named.
- The file a person may also edit by hand survives the round trip: other
  keys, comments, and its own line endings.

## Non-Goals

- **The standalone shell.** It has no relation surface: `readChangeGraph`
  has no caller in `packages/server` or `packages/webui`, and the Pipeline
  draws the declared order rather than the relation itself. Adding an
  editor there means a REST route, a transport message and a view that
  does not exist yet - a change of its own, if the shell ever grows a
  graph.
- **Drag and drop in the tree.** `TreeDataProvider` supports it through
  `TreeDragAndDropController`, and dropping one change onto another is the
  obvious gesture for "this follows that". It is also the gesture with no
  way to say which of three relations is meant, and no way to refuse
  legibly mid-drag. A context menu answers DW's request; drag and drop can
  be argued for separately once there is something to compare it against.
- **Editing an archived change's relations.** Archiving is what makes a
  record final, and the graph's value is that it still resolves to
  archived work.
- **A new gate.** `quality-gates` keeps its lint-time check unchanged.
  This change makes the same rules reachable earlier; it does not move
  them.

## Decisions

### Core writes the file, not the extension

The repository's invariant: business logic lives in `packages/core`, hosts
are thin. Reading the relation is already there, and the rules an edit
must respect (a change id exists, no self-reference, no cycle) are stated
in `checkChangeGraph`. A writer in the extension would restate them.

**Rejected: the extension edits the file through `vscode.workspace.fs`
and lets the lint gate catch mistakes.** It is less code today and puts
the refusal where the author cannot act on it - the failure is a CI run,
after the change has been pushed. It also leaves the second host, if one
ever arrives, to write its own copy of the same edit.

### A text edit, not a YAML round trip

`applyRelationEdit` rewrites the relation key in place: it replaces the
key's lines where the key is present, appends the key where it is not, and
removes the key where an edit leaves no value. Every other line of the
file is passed through unchanged, and the file's own line endings are kept.

**Rejected: parse to an object and serialise it back.** That needs a YAML
library core does not depend on, and the round trip loses comments and key
order - a file a person also edits by hand would come back reordered and
stripped, which is a worse defect than the one being fixed.

**Rejected: append-only, by writing `follows: [a, b]` on one line always.**
It is the smallest edit and it fights the file: a change with five
blockers becomes an unreadable line, and a hand-written block sequence
would be replaced by a flow sequence the author did not choose. The edit
keeps the shape it found where it can.

### The refusal is a value, not an exception

`editChangeRelation` returns either the new relations or a refusal with a
reason (`unknown-change`, `self-relation`, `cycle`, `archived-change`,
`unreadable-metadata`) and the ids involved. A host decides how to show
it; core decides what is wrong. A thrown error would make every caller
parse a message to tell a cycle from a typo.

### A cycle is checked on the would-be graph

The edit is applied to the graph in memory, `findChangeGraphCycles` runs
on the result, and the write happens only where it finds nothing. This is
the same function the gate uses, so the two answers cannot drift - and the
refusal names the changes in the cycle, which is what the author needs to
undo it.

### The pickers show what is already stated

Remove Relation lists only the relations the change actually states, so a
reader never removes something that was not there. Add Relation lists
every change the workspace knows, active and archived, with the ones
already related marked - and refuses the archived ones only where the
change being edited is itself archived, since a live change may perfectly
well follow archived work.

## Risks / Trade-offs

- **Two writers on one file.** A person may have `.openspec.yaml` open in
  the editor while a command rewrites it. VS Code reloads an unmodified
  file and warns on a dirty one; the command reads the file immediately
  before writing, so it cannot overwrite a change made since the view was
  drawn. It can still lose an unsaved edit the person has in the editor
  buffer - the same risk every file-writing command in this extension
  already carries.
- **The graph is read twice per edit.** Once to validate, once to redraw.
  This repository's graph is 269 changes and
  `the-pipeline-reads-each-workspace-once` showed what reading the archive
  repeatedly costs. An edit is a deliberate, rare action, and it reads the
  archive because a relation may name archived work; the read is not on a
  refresh path.
- **The context menu grows.** Two more entries on a Changes row, which
  already carries Archive, Rollback and the rest. They go in a group of
  their own so a destructive action is never the neighbour a misclick
  finds.
- **A relation edited from the view is not recorded anywhere else.** No
  audit entry: this writes a repository file the way the change editor
  does, and git is the record. Stated here so it is a decision rather than
  an omission.
