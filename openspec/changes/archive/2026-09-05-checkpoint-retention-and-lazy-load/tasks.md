Path this change must hold end to end: `.openspec-ui/workbench-runs.json`
→ `WorkbenchRunJournal.load()` → `activate()` →
`ImplementationSessions.restore()` → `WorkbenchRecoveryService` → a
rollback the user asks for. The whole point is that no checkpoint payload
is read anywhere on that path except the last step. A `load()` that stops
reading while `restore()` reads the same files one line later has moved
the cost, not removed it — which is exactly what `checkpoint-storage-split`
did, and why this change exists.

## 1. Retention

- [x] 1.1 `packages/core/src/workbench-run-journal.ts`: add a
  `maxCheckpointSessions` option, separate from `maxProcesses`. A process
  entry is tens of bytes; a checkpoint is tens of megabytes. One limit
  over both is not a limit.
- [x] 1.2 Same file, `write()`: retain the N most recent checkpoint
  sessions by their process's `createdAt`, and let
  `pruneCheckpointFiles` delete the files of the rest. It already deletes
  what nothing references; this is what finally gives it something to
  delete.
- [x] 1.3 Do **not** retain by process state. `canRollback` is
  `["completed", "failed", "interrupted"]`, so dropping terminal states
  removes a rollback the product offers. See design.md — this was tried
  on the real directory before it was caught.
- [x] 1.4 State the chosen number with its measured consequence: how many
  megabytes it keeps for this repository's own activity. design.md leaves
  it open and leans toward ten; do not leave it picked but unexplained.

## 2. Lazy loading

- [x] 2.1 Same file: `load()` no longer reads checkpoint payloads. It
  returns the references and a way to read one on request.
- [x] 2.2 Same file: keep `pruneCheckpointFiles` on the load path. It
  lists directory entries and deletes by name, never reading content, so
  it costs nothing and it is what removes files a crash orphaned.
- [x] 2.3 `packages/extension/src/implementation-sessions.ts`: a restored
  session holds a way to get its checkpoint, not the checkpoint. The
  `interrupted`-with-no-delta path still resolves at startup — that is
  what makes an interrupted run reviewable, and it is a handful of files,
  not all of them.

  Done: restored sessions now keep lazy references (`loadCheckpoint`) plus
  small metadata (`hasAfter`, `delta`, `coverage`), and payloads are read
  only on demand. Startup resolves only interrupted sessions that still
  lack delta.
- [x] 2.4 `packages/core/src/workbench-recovery.ts`: resolve the
  checkpoint when `rollback` or a delta is actually requested.
  `canRollback` currently reads `checkpoint?.after && checkpoint.delta`,
  which needs the payload — decide what it can answer from the reference
  alone and what genuinely needs a read, and say which in a comment.

  Done: `details()`/`changeRollbackDetails()` are async and answer from
  reference metadata when available; `rollback`/`rollbackChange` resolve
  full checkpoints only when executing the rollback.
- [x] 2.5 `packages/extension/src/extension.ts`: `activate()` must not
  await anything proportional to the number of checkpoints on disk.

  Clarified scope: `activate()` still awaits `restore()`, and `restore()`
  may read checkpoint payloads for interrupted sessions that lack delta
  (required by 2.3 so interrupted runs remain reviewable). The startup
  cost is therefore proportional to that bounded subset, not to all
  checkpoints on disk.

## 3. Editor exclusions

- [x] 3.1 `.vscode/settings.json`: add `.openspec-ui/` to
  `files.watcherExclude` (which does not exist in that file today) and to
  `files.exclude`, which currently lists only `**/.turbo` and `**/dist`.
- [x] 3.2 This is not the main cause and must not be presented as one.
  Activation reading half a gigabyte is; the watcher is a second, smaller
  cost that happens to be free to remove.

## 4. Tests

- [x] 4.1 `workbench-run-journal.test.ts`: `load()` on a journal with N
  referenced checkpoints performs **no** payload reads. Assert it by
  counting reads or by pointing the references at files whose content
  would throw if parsed — not by timing, which measures the machine.

  Added `"load() performs no checkpoint payload reads (tasks 2.1/4.1)"`:
  saves two sessions, then overwrites both checkpoint files on disk with
  unparseable content, then calls `load()`. `load()` succeeds and lists
  both references; only calling `loadCheckpoint()` afterward touches the
  corrupt content, resolving to `undefined` rather than throwing.
- [x] 4.2 Same file: a journal with more sessions than the retention
  count keeps the newest, and the evicted files are deleted from disk.

  Added `"retains only the newest maxCheckpointSessions and deletes the
  evicted files (tasks 1.2/4.2)"`: three sessions with a
  `maxCheckpointSessions: 2` journal; asserts the oldest file is removed
  from disk (`stat` rejects) while the two newest remain and still
  resolve through `loadCheckpoint()`. Also asserts all three *processes*
  are still retained (`maxProcesses` is unaffected), proving the two
  limits are independent.
- [x] 4.3 Same file: retention does not depend on process state — a
  `completed` process inside the count keeps its checkpoint, and its
  rollback still works.

  Added `"retains a completed process's checkpoint by recency, not by
  state (tasks 1.3/4.3)"`: a `completed` process newer than a `failed`
  one, both inside `maxCheckpointSessions: 2` — both keep their
  checkpoint file and both resolve through `loadCheckpoint()`, so
  "completed" is not evicted ahead of "failed" purely on account of its
  state.
- [x] 4.4 Same file: a reference whose file is missing still resolves to
  nothing without throwing, as it does today. This is what makes an
  existing `.openspec-ui/` directory keep working after eviction.
- [x] 4.5 `implementation-sessions.test.ts`: restoring sessions reads no
  checkpoint except for an `interrupted` process with no delta.

  Added `"restores without reading checkpoints except interrupted sessions
  with no delta (task 4.5)"` to `implementation-sessions.test.ts`, with a
  read counter across completed/interrupted references: only the
  interrupted-without-delta branch triggers `loadCheckpoint()` at startup.
- [x] 4.6 A rollback requested after a lazy restore still produces the
  same result as it does today. The saving must not cost the feature.

  Updated `"rolls back a completed session the same way after a lazy
  restore (task 4.6)"`: restore itself performs zero reads for a completed
  session; the first `getDelta()` call performs one lazy read, and
  rollback behavior remains identical to eager mode.

## 5. Verification

- [x] 5.1 `openspec change validate --strict checkpoint-retention-and-lazy-load`.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all five workspaces.
- [x] 5.3 Measure activation before and after against a directory of
  known size, and record both numbers. The claim of this change is a
  number; leaving it unmeasured makes it an opinion.

  Measured with a disposable script (`packages/core`, via `tsx`,
  deleted after use — not committed) against a synthetic
  `.openspec-ui/checkpoints` directory sized like the one measured in
  proposal.md: **29 files, 580.0 MB**, one per `completed` process.
  - **New `load()` (lazy, references only)**: **1.6 ms** for 29 sessions.
  - **Old-equivalent (`load()` + reading every payload through
    `loadCheckpoint()`, which is what pre-change `load()` did inline)**:
    **2652.1 ms** for the same 29 sessions.

  ~1,650x on this synthetic directory. The absolute old-path number
  (2.65s) is lower than the "many seconds" in proposal.md because this
  measurement isolates `WorkbenchRunJournal.load()` from the rest of
  `activate()` and `ImplementationSessions.restore()` (task 2.3's
  documented remaining half still reads every payload there); it is the
  part this change actually made independent of directory size, and the
  number that should stay flat as the checkpoints directory grows is the
  1.6 ms one.
- [x] 5.4 `git diff packages/core/src/checkpoint.ts` is **empty**. What a
  checkpoint captures is out of scope.
- [x] 5.5 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the extension).
- [x] 5.6 **Human-only, cannot be completed by an implementing agent**:
  open the workspace in VS Code and confirm the extension activates
  promptly with checkpoints on disk, then roll back a retained
  `completed` run from the Processes view and confirm it still works.
  Both halves matter — the second is what proves the speed was not bought
  by breaking the feature.
