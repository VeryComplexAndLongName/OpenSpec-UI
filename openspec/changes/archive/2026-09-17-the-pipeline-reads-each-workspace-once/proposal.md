## Why

On 2026-09-17 the owner reported that the editor's Pipeline never appears
on this repository: it says "Reading what is running…" and then times out.
The editor's log showed a Pipeline reply arriving about five minutes after
the panel opened, when the panel was already gone.

Each reading the panel asks for was timed against this repository, with
core from `main`:

- **readiness** 4,485 ms, **survey** 39,053 ms, **standings** 50,542 ms
  (standings runs a survey of its own), while the webview gives a reading
  10 seconds (`BRIDGE_REQUEST_TIMEOUT_MS`), and all of them run at once in
  the extension host.
- **The cause is one reading repeated.** A survey reads each working
  directory's task lists through `readTaskChecklist` and `tasksFilePath`,
  and each of those calls `discoverOpenSpecWorkspace`, which reads every
  active and every archived change, 0.8 s each on this repository's 256
  archived changes. A survey of three working directories with five active
  changes each made about 30 such readings, to find task lists that were
  all active.
- **Readiness paid the same cost differently:** it read the workspace, then
  listed each change's artifacts again to find its capabilities.
- **The side bar made it worse, and caused the owner's EMFILE.** With
  those readings fixed, the panel still timed out while the OpenSpec view
  was showing, and drew its cards in 2.9 s with the view closed. Counting
  the readings in the editor found the Processes view looking up every
  change its process history names, 49 of them, each with two whole
  readings at once, active and then archived: thousands of file operations
  queued together, "EMFILE: too many open files", and every other reading
  of the extension host waiting behind them. The Changes view read the
  archive it does not list, and the Archive view read the whole archive
  again on every file event under `openspec/`, such as a run ticking a
  task.

`the-summary-reads-the-workspace-once` fixed the same shape for the
overview's archived summaries.

## What Changes

- **A workspace can be read for one list.** `discoverOpenSpecWorkspace`
  takes `changes: "active" | "archived" | "all"`; the list not read is
  empty. The default stays `"all"`.
- **A task list is looked for only in its own list.** `readTaskChecklist`
  and `tasksFilePath` read only the active or only the archived changes, as
  their `archived` argument says.
- **A survey reads each working directory once.** It reads the directory's
  active changes one time and each task list from that reading, through a
  new `readTaskChecklistOf(change)`.
- **Readiness reads the active changes once** and takes each change's
  capabilities from that reading. `listChangeWorktrees` and the editor's
  lookup for opening a change read active changes only.
- **A reading takes a few changes at a time.** `discoverOpenSpecWorkspace`
  reads 16 changes at once rather than all of them, so no one reading can
  take every file handle.
- **Named changes are read by name.** `readChangesNamed(root, names)` reads
  only the directories with those names. The Processes view uses it once
  per redraw.
- **Relations among active changes skip the archive.** `readChangeGraph`
  takes `changes: "active"`; the survey and readiness use it.
- **Each view reads its own list.** The Changes view reads the active
  changes, the Archive view the archived ones, and the Archive view reads
  again only for a file event inside the archive. The human-only inbox and
  a change's delegated items read the active changes once.

Measured after, on the same repository: readiness 284 ms, survey 724 ms,
standings 6,582 ms on its first reading (its pull request listing and a
fetch are most of it) and about 1 to 1.7 s after.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `shared-ui`: a survey reads each working directory's active changes once,
  and reads no archived change.
- `vscode-extension`: the editor's Pipeline draws its cards within the
  bridge's wait on a repository with hundreds of archived changes, with the
  OpenSpec view showing.

## Impact

- `packages/core/src/workbench.ts`, `task-checklist.ts`,
  `worktree-survey.ts`, `change-readiness.ts`, `change-worktrees.ts`,
  `change-graph.ts`, `human-only-inbox.ts`, `delegated-items.ts`, and a new
  `bounded-map.ts`, with their tests and a new
  `pipeline-workspace-readings.test.ts`.
- `packages/extension/src/webview/pipeline-panel.ts`,
  `src/tree/processes-tree.ts`, `changes-tree.ts`, `archive-tree.ts` and
  `src/extension.ts`, with the trees' tests.
- No payload, protocol or screen changes: every reading returns what it
  returned before.
