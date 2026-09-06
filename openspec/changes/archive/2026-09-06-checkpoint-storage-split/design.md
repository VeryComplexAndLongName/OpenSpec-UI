## Context

See `proposal.md` for the measurement. Facts read from the code:

- `WorkbenchRunJournalData` is `{ processes: WorkbenchProcess[];
  checkpointSessions: PersistedCheckpointSession[] }`, and
  `PersistedCheckpointSession` is `{ processId, changeName?, checkpoint:
  SerializedWorkbenchCheckpoint }`.
- `write()` serializes the whole document with `JSON.stringify(document,
  null, 2)` into a temporary file and renames it over the real one — an
  atomic replace, which is correct and stays.
- `load()` already validates two versions independently:
  `WORKBENCH_RUN_JOURNAL_VERSION` (currently `1`) and each session's
  `checkpoint.version`, reporting `unsupported-journal-version` and
  `unsupported-checkpoint-version` with a message telling the user to
  upgrade.
- `WorkbenchRunJournalOptions` has `maxProcesses`; sessions are pruned
  through their process, per `persistent-workbench-runs`' existing
  requirement "Run retention removes matching checkpoint data".
- `checkpoint.ts` defaults: `maxFiles: 2_000`, `maxBytes: 20 * 1024 *
  1024`.

## Goals / Non-Goals

**Goals:**

- Make recording a process's state cost a small write, independent of how
  much checkpoint data is retained.
- Keep every existing workspace's rollback history through the change.
- Keep the atomic-replace property the current writer has.

**Non-Goals:**

- Capturing less, or capping checkpoints harder. Same data, cheaper
  storage.
- A database.
- Changing retention policy, rollback behavior, or any UI.

## Decisions

### One file per checkpoint session, referenced from the journal

`.openspec-ui/checkpoints/<processId>.json` holds one session. The journal
keeps `{ processId, changeName? }` per session, which is what retention
needs and nothing more.

**Rejected alternative**: keep one document and merely stop
pretty-printing. Rejected — indentation is perhaps a fifth of the size,
and every process state change would still rewrite every retained
checkpoint. It treats the symptom.

**Rejected alternative**: keep one document and write it less often
(debounce). Rejected — it trades correctness for size: a crash between
debounced writes loses process history, which is the one thing the journal
exists to survive.

### The journal version goes to 2, and version 1 is migrated on load

A version-1 journal is read, each embedded session written out as its own
file, and the journal rewritten in the new shape.

**Rejected alternative**: read both shapes indefinitely without bumping
the version. Rejected — the existing `unsupported-journal-version` path
exists precisely so an older OpenSpec UI meeting a newer journal says so
instead of misreading it. Writing a new shape under the old version number
would defeat a mechanism this project already built and tested.

**Rejected alternative**: discard version-1 sessions instead of migrating.
Rejected — that silently destroys the rollback history of every existing
workspace, including the one where this defect was found.

### Checkpoint files are written compactly; the journal stays indented

**Rejected alternative**: one rule for both. Rejected — they are read by
different readers. The journal is small and gets opened by humans
diagnosing a run (this defect was found by reading it). A checkpoint file
is base64 blobs; indenting it costs size and helps nobody.

### A session file is written before the journal references it

Ordering matters at a crash boundary. The file is written first; the
journal's reference to it follows.

**Rejected alternative**: write the reference first. Rejected — a crash
between the two would leave the journal promising a rollback that does not
exist. In the chosen order the same crash leaves an unreferenced file,
which is inert and cleanable.

### A referenced-but-missing file degrades; it does not fail the load

A session whose file is absent is reported as having no recoverable
checkpoint. The journal still loads, and its process history is intact.

**Rejected alternative**: treat it as journal corruption. Rejected — the
same reasoning the existing loader already applies to an unsupported
checkpoint version: process history is the more valuable half and must
survive a problem in the other half. Losing a run's whole history because
one rollback blob went missing is a worse outcome than losing the
rollback.

## Risks / Trade-offs

- **[Risk]** Migration runs on a 356 MB document, on a path that blocks
  the first load. → **Mitigation**: it happens once per workspace, and the
  alternative — reading that document on every write — is what this change
  removes. The tasks require it to be exercised against a fixture of
  realistic size rather than a two-entry stub.
- **[Risk]** Orphaned checkpoint files accumulate if a crash lands between
  the two writes. → **Mitigation**: load removes checkpoint files no
  journal entry references. This is safe precisely because the journal is
  the authority on what exists.
- **[Trade-off]** Two files can disagree where one could not. Accepted,
  and bounded by the ordering decision above: the only reachable
  disagreement is an unreferenced file, which is inert.

## Migration Plan

Automatic and one-way, on first load after upgrade. A version-1 journal's
embedded sessions become files and the journal is rewritten as version 2.
An older OpenSpec UI opening a version-2 journal reports
`unsupported-journal-version` and asks the user to upgrade — the existing,
tested path, unchanged.

## Open Questions

None.
