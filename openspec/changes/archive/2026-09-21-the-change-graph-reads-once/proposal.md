## Why

The owner reported on 2026-09-21 that the Change Graph builds very slowly
over this repository's archive and holds a processor at 100%.

It is not the size of the archive. Measured the same day, `readChangeGraph`
over all 293 archived changes takes **159 ms** of wall time and 173 ms of
processor. What costs is how often the view asks for it:

- **Once per row, not once per drawing.** `ChangeGraphTreeProvider`
  reads the whole graph in every `getChildren`, and VS Code calls
  `getChildren` for the root and again for every expanded row. A graph
  with ten rows open is ten full reads per drawing.
- **On every file event, not on the ones that matter.** The view is
  refreshed by the `openspec/**` watcher for any event at all. The graph
  reads two directory listings and each change's `.openspec.yaml` -
  nothing else - so a run ticking `tasks.md` changes nothing in it, and
  every tick re-reads the whole archive once per open row.

A run ticks tasks many times a minute. That is the 100%.

The Changes tree met the same shape before and was fixed for it: its code
still says "each tick read every archived change again"
(the-pipeline-reads-each-workspace-once). The graph was not.

## What Changes

- **One read per refresh.** The view holds one reading, shared by every
  `getChildren` and `getParent` until the next refresh; concurrent calls
  right after a refresh share one read rather than each starting their
  own.
- **Refreshed only by what it reads.** Core says which paths the graph
  reads - a change's `.openspec.yaml`, and a change directory appearing
  or going, active or archived - and the editor refreshes the graph only
  for an event on one of those. A task ticked, a proposal edited or a
  spec delta written leaves it alone.
- The Changes tree, the specs and the rest keep refreshing as they do.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `vscode-extension` - when the Change Graph reads, and what refreshes it.

## Impact

- `packages/core/src/change-graph.ts` (which paths it reads),
  `packages/extension/src/tree/change-graph-tree.ts`,
  `packages/extension/src/extension.ts` (the watcher).
- A changeset: core and the extension change.

## Explicitly out of scope

- **Keeping less archive.** The archive is 7.8 MB for 293 changes, and
  reading all of it is 159 ms; nothing here needs it to be smaller. The
  owner settled on 2026-09-21 that the archive stays where it is, in the
  repository. Whether the views should show only recent archived changes
  is a separate question, and one for after this is measured in use.
- **The standalone.** It has no Change Graph view, and nothing there reads
  the graph.
