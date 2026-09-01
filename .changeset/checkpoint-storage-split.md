---
"@openspec-ui/core": minor
---

Checkpoint sessions are now stored one file per session under `.openspec-ui/checkpoints/<processId>.json` instead of embedded in `.openspec-ui/workbench-runs.json`; the journal keeps only a `{ processId, changeName? }` reference per session. A live workspace's journal had grown to 356.6 MB because every process state change re-serialized every retained checkpoint (up to 20 MB each) along with it — recording a process's state now only rewrites the small journal, and a finalized checkpoint is written once and never rewritten. `WORKBENCH_RUN_JOURNAL_VERSION` moves to `2`; a version-1 journal is migrated automatically on first load, writing its embedded sessions out as files. A checkpoint file that no journal entry references (e.g. left behind by an interrupted write) is removed on load; a referenced file that is missing degrades to "no recoverable checkpoint" for that process rather than failing the whole load.
