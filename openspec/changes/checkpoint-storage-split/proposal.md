## Why

Measured live on 2026-09-01: `.openspec-ui/workbench-runs.json` in this
repository's own working copy had reached **356.6 MB**, and was being
rewritten in full several times per stage.

The cause is a single document holding two things with opposite
characteristics:

```ts
export interface WorkbenchRunJournalData {
    processes: WorkbenchProcess[];              // ~100 bytes, changes constantly
    checkpointSessions: PersistedCheckpointSession[];  // up to 20 MB, never changes once finalized
}
```

Every write goes through one line
(`packages/core/src/workbench-run-journal.ts:183`):

```ts
await writeFile(temporaryPath, `${JSON.stringify(document, null, 2)}\n`, "utf8");
```

So a process moving from `queued` to `running` re-serializes and rewrites
every retained checkpoint's file contents. A stage start and its
completion cost two full rewrites of the whole store.

The arithmetic matches exactly. The measured journal held **17 checkpoint
sessions** and 26 290 file records; `packages/core/src/checkpoint.ts`'s
defaults cap one checkpoint at `maxFiles: 2_000` and `maxBytes: 20 MB`, so
17 × 20 MB ≈ 340 MB against 356.6 MB observed. Nothing is malfunctioning —
this is the design working as written.

`JSON.stringify(document, null, 2)` compounds it: every line of base64
file content carries indentation nobody will ever read.

The cheap thing is paying for the expensive thing. A process row is small
and changes often; a finalized checkpoint is large and never changes
again.

## What Changes

- `packages/core/src/workbench-run-journal.ts`: checkpoint sessions move
  out of the journal document into one file per session under
  `.openspec-ui/checkpoints/`. The journal keeps process rows plus a
  reference per session (`processId`, `changeName`), so retention still
  knows what to delete without reading any checkpoint content.
- Same file: a finalized checkpoint is written once and is never rewritten
  by a process state change.
- Same file: checkpoint files are serialized without pretty-printing.
  Their content is base64; the journal itself stays indented, because it
  is small and worth reading by hand.
- Same file: `WORKBENCH_RUN_JOURNAL_VERSION` goes to `2`, and a version-1
  journal is migrated on load — its sessions written out as files, the
  journal rewritten in the new shape. Without migration, every existing
  workspace would lose its rollback history.
- Retention deletes a session's file along with its journal reference. A
  reference whose file is missing degrades to "no rollback available"
  rather than failing the load.

## Capabilities

### New Capabilities

(none — this extends `persistent-workbench-runs`)

### Modified Capabilities

- `persistent-workbench-runs`: checkpoint data is stored separately from
  process history, so recording a process's state does not rewrite it;
  the journal gains a version and a migration from the previous one.

## Impact

- `packages/core/src/workbench-run-journal.ts`, and the recovery path that
  reads it.
- `.openspec-ui/` gains a `checkpoints/` directory. Existing journals are
  migrated in place on first load.
- No change to `checkpoint.ts`'s limits, to what a checkpoint captures, to
  rollback behavior, or to any UI.

## Explicitly out of scope

- Reducing what a checkpoint captures, or tightening `maxFiles`/
  `maxBytes`. That trades rollback coverage for size; this change makes
  the same data cheap to store instead.
- Replacing JSON with a database. This project's posture is that heavy
  dependencies are not bundled (ADR 0013 rejected one over a ~20 MB
  binary), and per-file storage removes the cost without one.
- Changing the retention policy itself. The existing policy is unchanged;
  only what it deletes alongside a process row is extended.
