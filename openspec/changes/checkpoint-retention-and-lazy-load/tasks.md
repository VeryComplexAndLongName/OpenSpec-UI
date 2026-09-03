Path this change must hold end to end: `.openspec-ui/workbench-runs.json`
→ `WorkbenchRunJournal.load()` → `activate()` →
`ImplementationSessions.restore()` → `WorkbenchRecoveryService` → a
rollback the user asks for. The whole point is that no checkpoint payload
is read anywhere on that path except the last step. A `load()` that stops
reading while `restore()` reads the same files one line later has moved
the cost, not removed it — which is exactly what `checkpoint-storage-split`
did, and why this change exists.

## 1. Retention

- [ ] 1.1 `packages/core/src/workbench-run-journal.ts`: add a
  `maxCheckpointSessions` option, separate from `maxProcesses`. A process
  entry is tens of bytes; a checkpoint is tens of megabytes. One limit
  over both is not a limit.
- [ ] 1.2 Same file, `write()`: retain the N most recent checkpoint
  sessions by their process's `createdAt`, and let
  `pruneCheckpointFiles` delete the files of the rest. It already deletes
  what nothing references; this is what finally gives it something to
  delete.
- [ ] 1.3 Do **not** retain by process state. `canRollback` is
  `["completed", "failed", "interrupted"]`, so dropping terminal states
  removes a rollback the product offers. See design.md — this was tried
  on the real directory before it was caught.
- [ ] 1.4 State the chosen number with its measured consequence: how many
  megabytes it keeps for this repository's own activity. design.md leaves
  it open and leans toward ten; do not leave it picked but unexplained.

## 2. Lazy loading

- [ ] 2.1 Same file: `load()` no longer reads checkpoint payloads. It
  returns the references and a way to read one on request.
- [ ] 2.2 Same file: keep `pruneCheckpointFiles` on the load path. It
  lists directory entries and deletes by name, never reading content, so
  it costs nothing and it is what removes files a crash orphaned.
- [ ] 2.3 `packages/extension/src/implementation-sessions.ts`: a restored
  session holds a way to get its checkpoint, not the checkpoint. The
  `interrupted`-with-no-delta path still resolves at startup — that is
  what makes an interrupted run reviewable, and it is a handful of files,
  not all of them.
- [ ] 2.4 `packages/core/src/workbench-recovery.ts`: resolve the
  checkpoint when `rollback` or a delta is actually requested.
  `canRollback` currently reads `checkpoint?.after && checkpoint.delta`,
  which needs the payload — decide what it can answer from the reference
  alone and what genuinely needs a read, and say which in a comment.
- [ ] 2.5 `packages/extension/src/extension.ts`: `activate()` must not
  await anything proportional to the number of checkpoints on disk.

## 3. Editor exclusions

- [ ] 3.1 `.vscode/settings.json`: add `.openspec-ui/` to
  `files.watcherExclude` (which does not exist in that file today) and to
  `files.exclude`, which currently lists only `**/.turbo` and `**/dist`.
- [ ] 3.2 This is not the main cause and must not be presented as one.
  Activation reading half a gigabyte is; the watcher is a second, smaller
  cost that happens to be free to remove.

## 4. Tests

- [ ] 4.1 `workbench-run-journal.test.ts`: `load()` on a journal with N
  referenced checkpoints performs **no** payload reads. Assert it by
  counting reads or by pointing the references at files whose content
  would throw if parsed — not by timing, which measures the machine.
- [ ] 4.2 Same file: a journal with more sessions than the retention
  count keeps the newest, and the evicted files are deleted from disk.
- [ ] 4.3 Same file: retention does not depend on process state — a
  `completed` process inside the count keeps its checkpoint, and its
  rollback still works.
- [ ] 4.4 Same file: a reference whose file is missing still resolves to
  nothing without throwing, as it does today. This is what makes an
  existing `.openspec-ui/` directory keep working after eviction.
- [ ] 4.5 `implementation-sessions.test.ts`: restoring sessions reads no
  checkpoint except for an `interrupted` process with no delta.
- [ ] 4.6 A rollback requested after a lazy restore still produces the
  same result as it does today. The saving must not cost the feature.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict checkpoint-retention-and-lazy-load`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all five workspaces.
- [ ] 5.3 Measure activation before and after against a directory of
  known size, and record both numbers. The claim of this change is a
  number; leaving it unmeasured makes it an opinion.
- [ ] 5.4 `git diff packages/core/src/checkpoint.ts` is **empty**. What a
  checkpoint captures is out of scope.
- [ ] 5.5 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the extension).
- [ ] 5.6 **Human-only, cannot be completed by an implementing agent**:
  open the workspace in VS Code and confirm the extension activates
  promptly with checkpoints on disk, then roll back a retained
  `completed` run from the Processes view and confirm it still works.
  Both halves matter — the second is what proves the speed was not bought
  by breaking the feature.
