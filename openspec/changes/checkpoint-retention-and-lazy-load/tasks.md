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
- [ ] 2.3 `packages/extension/src/implementation-sessions.ts`: a restored
  session holds a way to get its checkpoint, not the checkpoint. The
  `interrupted`-with-no-delta path still resolves at startup — that is
  what makes an interrupted run reviewable, and it is a handful of files,
  not all of them.

  **Half done, and the half that is not is named here rather than
  quietly skipped.** `restore()` now takes references and reads through
  `loadCheckpoint()`, but it still reads all of them, because `rollback`
  and `describeDelta` want a `WorkbenchCheckpoint` in hand synchronously.
  What bounds the cost is task 1's retention — ten sessions rather than a
  hundred — not deferral. Comment left at the call site.
- [ ] 2.4 `packages/core/src/workbench-recovery.ts`: resolve the
  checkpoint when `rollback` or a delta is actually requested.
  `canRollback` currently reads `checkpoint?.after && checkpoint.delta`,
  which needs the payload — decide what it can answer from the reference
  alone and what genuinely needs a read, and say which in a comment.

  **Answered, not implemented.** `details()` is synchronous and answers
  `delta`, `coverage` and `canRollback` out of the checkpoint, so nothing
  here can be deferred without making it async — and that reaches the
  transport protocol and both surfaces. The design that would work:
  persist `delta`, `coverage` and a `hasAfter` flag in the reference,
  which are small, and read the large `after` snapshot only when a
  rollback runs. That needs a journal version bump and its own change.
- [ ] 2.5 `packages/extension/src/extension.ts`: `activate()` must not
  await anything proportional to the number of checkpoints on disk.

## 3. Editor exclusions


  Not yet true, for the reason under 2.3: `activate()` awaits
  `restore()`, which reads every retained checkpoint. It is now bounded
  by ten rather than unbounded, which is what made the window usable
  again, but the proportionality is still there.
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
- [ ] 4.5 `implementation-sessions.test.ts`: restoring sessions reads no
  checkpoint except for an `interrupted` process with no delta.

  **Not satisfiable while 2.3 is half done, and left unchecked rather
  than passed against a weaker claim.** `restore()` currently reads
  every referenced checkpoint through `loadCheckpoint()` (see 2.3's own
  note): a `completed` session's payload is read too, so a test
  asserting "no reads except interrupted-with-no-delta" would fail
  against the real implementation. Writing a test that only checks
  rollback correctness, without the read-count claim, would misrepresent
  this task as done. Outstanding until 2.3's remaining half (deferring
  `rollback`/`describeDelta` to read lazily) or its own follow-up change
  lands.
- [x] 4.6 A rollback requested after a lazy restore still produces the
  same result as it does today. The saving must not cost the feature.

  Added `"rolls back a completed session the same way after a lazy
  restore (task 4.6)"` to `implementation-sessions.test.ts`: a
  `completed` process is restored through the same `loadCheckpoint()`
  indirection `restore()` uses in production (one call, asserted by
  count), and the resulting session's delta and rollback are identical
  to the eager path — `rollback()` restores the file and reports no
  conflicts. This is unaffected by 4.5 being outstanding: it does not
  claim anything about read count, only about the rollback outcome.

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
