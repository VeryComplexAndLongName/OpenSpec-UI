Path this change must hold end to end: a finalized checkpoint → its own
file under `.openspec-ui/checkpoints/` → a reference in the journal → a
process state change that rewrites **only** the journal → load, which
reads references and resolves files → retention, which deletes both. A
split that still serializes checkpoint content on a process state change
satisfies a naive test and fixes nothing; assert the write size, not just
the shape.

Note on local checks: `npm run lint` currently fails on this machine with
`ENOENT ... openspec/changes/agent-detection-timeout/.openspec.yaml`, from
a concurrent session's uncommitted archive moves. Unrelated to this
change — do not try to fix it, and do not mark a task complete on it.

## 1. Storage shape

- [x] 1.1 `packages/core/src/workbench-run-journal.ts`: `WorkbenchRunJournalDocument`'s
  `checkpointSessions` becomes an array of references — `{ processId,
  changeName? }` — with no `checkpoint` field. `WorkbenchRunJournalData`
  (the in-memory shape callers use) keeps carrying full sessions; only
  what is written to the journal file changes.
- [x] 1.2 Same file: `WORKBENCH_RUN_JOURNAL_VERSION` becomes `2`. Do
  **not** write the new shape under version `1` — the existing
  `unsupported-journal-version` path exists so an older build says so
  instead of misreading a newer file.
- [x] 1.3 Same file: a session is stored at
  `.openspec-ui/checkpoints/<processId>.json`, holding exactly the
  `SerializedWorkbenchCheckpoint` and the session's `changeName`. Keep the
  existing per-checkpoint `version` field and its
  `unsupported-checkpoint-version` check — that check moves with the data,
  it is not removed.
- [x] 1.4 Same file: checkpoint files are written with
  `JSON.stringify(value)` — no indentation. The journal keeps
  `JSON.stringify(document, null, 2)`: it is small and is read by hand.

## 2. Writing

- [x] 2.1 `packages/core/src/workbench-run-journal.ts`, `write()`: a
  session's file is written **before** the journal that references it. A
  crash between the two must leave an unreferenced file, never a reference
  to a file that does not exist.
- [x] 2.2 Same method: a session whose file already exists is **not**
  rewritten. A finalized checkpoint never changes; rewriting it is the
  cost this change exists to remove.
- [x] 2.3 Same method: keep the temporary-file-then-`rename` atomic
  replace for both the journal and each checkpoint file. Do **not**
  replace it with a direct `writeFile` — a torn journal is worse than a
  slow one.
- [x] 2.4 Same method: writing a process state change must not read or
  serialize any checkpoint content. This is the whole point; if a code
  path still touches `session.checkpoint` on that route, the change has
  not been made.

## 3. Loading

- [x] 3.1 `packages/core/src/workbench-run-journal.ts`, `load()`: for a
  version-2 journal, read each referenced session's file and assemble the
  same `WorkbenchRunJournalData` callers already receive. No caller
  changes.
- [x] 3.2 Same method: a referenced session whose file is missing or
  unreadable is reported as having no checkpoint, and the load
  **succeeds**. Do **not** raise a load error for it — process history is
  the more valuable half, exactly as the existing unsupported-checkpoint
  handling already assumes.
- [x] 3.3 Same method: checkpoint files that no journal entry references
  are deleted during load. The journal is the authority on what exists.
- [x] 3.4 Same method: a version-1 journal is migrated — each embedded
  session written out as a file, the journal rewritten as version 2 — and
  then loads normally. Do **not** discard version-1 sessions: that
  destroys the rollback history of every existing workspace.
- [x] 3.5 Same method: a journal whose version is neither 1 nor 2 still
  reports `unsupported-journal-version`, unchanged.

## 4. Retention

- [x] 4.1 `packages/core/src/workbench-run-journal.ts`: when a process is
  pruned, its checkpoint file is deleted along with its journal reference.
  A pruned process that leaves its file behind reintroduces the growth
  this change removes, one orphan at a time.
- [x] 4.2 Do **not** change the retention policy itself — which processes
  are pruned, or when. Only what is deleted alongside them.

## 5. Tests

- [x] 5.1 `packages/core/src/workbench-run-journal.test.ts`: a round trip
  through save and load returns the same `WorkbenchRunJournalData` as
  today, with sessions intact — the regression guard that callers see no
  change.
- [x] 5.2 Same file: **the size assertion.** After saving a journal with a
  large checkpoint session, recording a process state change and saving
  again leaves the checkpoint file's modification time and size unchanged,
  and the journal file itself stays small. Assert against the files; a
  test that only checks the returned object would pass with the defect
  present.
- [x] 5.3 Same file: a version-1 journal containing embedded sessions
  migrates to version 2, its sessions become files, and the loaded data
  matches what version 1 held.
- [x] 5.4 Same file: a referenced session whose file was deleted loads
  successfully, reporting that session without a checkpoint, and the
  process history is complete.
- [x] 5.5 Same file: a checkpoint file that no journal entry references is
  removed by load.
- [x] 5.6 Same file: pruning a process deletes its checkpoint file.
- [x] 5.7 Same file: an unsupported journal version and an unsupported
  checkpoint version each still produce their existing error codes.

## 6. Verification

- [x] 6.1 `openspec change validate --strict checkpoint-storage-split`.
- [x] 6.2 `npm run typecheck` and `npm run test` — green across all four
  workspaces. See the note at the top of this file about `npm run lint`.
  `sprint-report.test.ts` and `change-timeline.test.ts` have pre-existing
  Windows timeout flakes at 5000 ms under load; do not attempt to fix them
  here.
- [x] 6.3 `git diff packages/core/src/checkpoint.ts` is **empty**. What a
  checkpoint captures, and its `maxFiles`/`maxBytes` limits, are
  deliberately unchanged — this change makes the same data cheap to store,
  it does not store less of it.
- [x] 6.4 Version bump via `npx changeset` (`@openspec-ui/core` minor).
- [ ] 6.5 **Human-only, cannot be completed by an implementing agent**:
  on a workspace whose `.openspec-ui/workbench-runs.json` is already
  large, confirm after upgrade that the journal has shrunk to process rows
  and references, that `.openspec-ui/checkpoints/` holds one file per
  session, that rollback still works for a run that predates the change,
  and that starting a stage no longer rewrites hundreds of megabytes.
  Leave unchecked if you are an agent.
