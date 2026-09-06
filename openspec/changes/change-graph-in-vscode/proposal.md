## Why

The change graph exists and can only be read from a terminal. The place
people actually work with changes is the OpenSpec UI container in VS
Code, where five trees already stand: Changes, Archive, Specs, Processes,
Templates.

The obvious idea — render the graph *as* the Changes tree, replacing the
flat list — was considered and rejected on three grounds, one of them
measured.

**Measured**: of 145 changes in this repository, 14 are active and
**none of them states a relation**. All six edges are among archived
work. A graph in place of Changes would today render 14 roots: the same
flat list, with extra machinery.

**A graph duplicates nodes; Changes is where people act.**
`suite-survives-a-loaded-machine` appears three times in the rendering
because it has three parents. Each Changes row carries Validate,
Archive, Implement and Rollback — three copies of one change means three
buttons that archive it. Duplication is fine in a reference view and
wrong in a working one.

**Changes is already three levels deep**: change, artifact, task. The
graph would add two more on top.

So the graph earns a view of its own, read-only, and the question that
motivated the whole thing — *why is this number here* — earns a command
on the change itself.

## What Changes

- A sixth view in the OpenSpec UI container, rendering the relation
  read through `packages/core`. Read-only, with a "reveal in
  Changes/Archive" action so it stays a reference rather than a second
  place to act.
- A command on a change: show what it follows, walking back to the
  reasons for it. This is the ancestry view, reachable where the change
  is.
- Changes that state a blocking relation on something still active are
  marked as waiting, which is the first thing this graph is being asked
  for: what can be started now.

## Capabilities

### Modified Capabilities

- `vscode-extension`: the relation between changes is visible where
  changes are worked on, without turning the working list into a graph.

## Impact

- New tree provider, commands and menu entries in `packages/extension`;
  no new parsing — the reader comes from `packages/core`. Changeset
  needed for `openspec-ui-vscode`.

## Explicitly out of scope

- **Replacing the Changes tree.** See above; the reasons are recorded
  there so this is not reopened without new evidence.
- **Editing relations from the editor.** They are stated in
  `.openspec.yaml` beside the change, and a second way to write them
  invites two sources of truth. Reading is the whole job here.
- **A webview.** A tree is what VS Code renders natively and what the
  data already is; a webview would be a rendering engine to maintain for
  the same shape.
