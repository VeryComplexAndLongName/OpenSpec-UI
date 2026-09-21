Reported by the owner on 2026-09-21: the Change Graph builds very slowly
and holds a processor at 100%.

## 1. One read per drawing

- [x] 1.1 `ChangeGraphTreeProvider` holds one reading, shared by every
  `getChildren` and `getParent` until the next refresh.
- [x] 1.2 Calls that arrive together share one read: the reading is held
  as a promise, not as its result.
- [x] 1.3 A read that failed is not kept, so the next drawing tries again.

## 2. Refreshed only by what it reads

- [x] 2.1 `changeGraphReads(path)` in core says which paths the graph
  reads: a change's `.openspec.yaml`, and a change directory appearing or
  going, active or archived - and the archive directory itself.
- [x] 2.2 The editor's `openspec/**` watcher refreshes the graph only for
  such a path. Every other view keeps refreshing as it did.

## 3. Checks

- [x] 3.1 Measured before anything was changed: `readChangeGraph` over all
  293 archived changes takes 159 ms of wall time and 173 ms of processor.
  The cost was never the archive's size; it was that read, repeated once
  per open row on every file event.
- [x] 3.2 Tests: the root and two levels of rows are one read; three
  calls at once are one read; a refresh makes the next drawing read again
  and nothing else does; a failed read is retried. And the path table,
  Windows separators included.
- [x] 3.3 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`. The one failure is
  `packages/webui/scripts/build-metro-icons.test.mjs`, which fails on
  Windows for its line endings and fails the same way on untouched
  `main`.
- [x] 3.4 A changeset: core and the extension change.
- [x] 3.5 `openspec validate the-change-graph-reads-once --strict`.
- [x] 3.6 **Human-only.** The owner's editor, with a run ticking tasks and
  the Change Graph open with rows expanded, no longer holds a processor.
  **Deferred:** it needs a build of the extension that includes this, and
  the owner's editor runs 0.70.0. It moves to `openspec/deferred.md`.
