## Why

The VS Code extension started taking many seconds to activate. Measured
on 2026-09-03, on this repository:

- `.openspec-ui/checkpoints` held **531.6 MB in 29 files**, individual
  files 12–24 MB. It was 354.9 MB in 17 files that morning, right after
  `checkpoint-storage-split` landed.
- `.openspec-ui/workbench-runs.json` is 42 KB.

`activate()` awaits `journal.load()`, and `load()` loops over every
checkpoint reference calling `resolveCheckpointSession`, which reads and
`JSON.parse`s that reference's file — sequentially, before activation can
finish. So the extension read and parsed half a gigabyte on every window
open.

**`checkpoint-storage-split` moved the bytes out of the journal without
removing the read.** Its goal was that the journal stays small, and it
does; but `load()` immediately re-reads every payload it just stopped
embedding, so the cost it was written to remove is still paid in full.
The journal is 42 KB and the load is 531 MB.

Nothing bounds the growth. `write()` retains a checkpoint session for any
process still inside `maxProcesses` (default 100), whatever its state, and
`pruneCheckpointFiles` only deletes files **nothing references** — so with
every session referenced, it never has anything to delete. At roughly
20 MB per `apply` stage, a hundred retained processes is about two
gigabytes read at every activation.

## What Changes

- `packages/core/src/workbench-run-journal.ts`: `load()` stops reading
  checkpoint payloads. It returns the references it already has, plus a
  way to read one payload when something actually needs it.
- Same file: checkpoint sessions get their own retention bound, separate
  from `maxProcesses`. Processes are cheap to keep — a journal entry is
  tens of bytes; a checkpoint is tens of megabytes, and the two cannot
  share one limit.
- `packages/extension/src/implementation-sessions.ts` and the recovery
  service: resolve a checkpoint at the moment a rollback or a delta is
  requested, not at startup.
- `.vscode/settings.json`: exclude `.openspec-ui/` from the file watcher
  and from search. It is generated state, already in `.gitignore`, and
  the editor currently watches every byte of it.

## Capabilities

### New Capabilities

(none — this extends `persistent-workbench-runs`)

### Modified Capabilities

- `persistent-workbench-runs`: restoring runs at startup reads what it
  needs to list them, not the content of every checkpoint; and the
  number of retained checkpoints is bounded independently of the number
  of retained processes.

## Impact

- `packages/core/src/workbench-run-journal.ts` and its test.
- `packages/extension/src/implementation-sessions.ts`,
  `packages/extension/src/extension.ts`,
  `packages/core/src/workbench-recovery.ts` — every consumer that assumes
  a restored session already carries its checkpoint.
- `.vscode/settings.json`.
- Existing `.openspec-ui/` directories keep working: a reference whose
  file is gone already resolves to nothing, and that path is unchanged.

## Explicitly out of scope

- Making checkpoints smaller. `checkpoint.ts`'s `maxFiles`/`maxBytes`
  limits are what they are; `checkpoint-storage-split` deliberately left
  them alone and so does this. The problem here is how many are read and
  how long they are kept, not how large each one is.
- Changing which process states can be rolled back. `canRollback` covers
  `completed`, `failed` and `interrupted`, and this change must not
  narrow that — see design.md, where a state-based retention rule was
  considered and rejected for exactly that reason.
