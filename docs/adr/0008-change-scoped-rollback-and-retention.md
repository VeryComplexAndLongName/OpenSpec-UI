# 0008: Change-Scoped Rollback Instead of Task-Scoped, With Opt-In Retention

Status: Accepted

Date: 2026-08-18

## Context

Rollback (ADR 0004) restores exactly the files one process's checkpoint
touched, and is currently only offered per-process, only for active
changes (no code path checked archive status either way — it simply
never came up). Two related asks came up in review:

1. Should Rollback be scoped to individual `tasks.md` checklist items,
   so undoing "just task 3" doesn't also undo tasks 1 and 2 from the same
   run?
2. Should Rollback be available for archived changes too, and directly
   from the change itself rather than only by finding the right entry in
   the Processes list?

For (1), a concrete proposal was floated: a SQLite database recording a
diff per task, with a retention-period fork and a "restore with a
merge-risk warning" UX on rollback.

## Decision

1. **Rollback is scoped to the whole Change, not to individual tasks.**
   `rollbackChangeCheckpoints` (`packages/core/src/checkpoint.ts`)
   aggregates every finalized checkpoint recorded against a `changeName`:
   each file's restore target is its content from the *earliest*
   checkpoint that touched it (undo everything ever done under this
   Change); the conflict check compares against each file's *latest*
   known `afterHash`. Same fail-closed, all-or-nothing semantics as
   single-process rollback — any conflict refuses the entire restore, not
   just the conflicting file. No new storage: this is a pure aggregation
   over checkpoints the system already captures.
2. **Rejected the SQLite/per-task-diff proposal.** The actually hard part
   of task-scoped rollback is attribution (which files belong to which
   task), and no storage technology changes that — it needs incremental,
   per-checkbox-transition checkpoints, a materially bigger change to the
   capture path than anything storage-related. Separately, a native
   SQLite dependency in a VS Code extension carries real packaging risk
   (native addon build-per-platform, or a slower WASM fallback) that
   nothing else in this codebase's dependency-free, plain-JSON journal
   architecture (ADR 0004, ADR 0006) has taken on. And "restore with a
   merge-risk warning" is a materially more permissive philosophy than
   the fail-closed rollback this codebase has used everywhere else.
   Change-scoped rollback answers the same underlying want ("undo what I
   did to this change") without any of the above.
3. **Rollback works identically for archived changes.** Archiving
   (`archiveChange()`, a thin `openspec archive` CLI wrapper scoped to
   `openspec/changes/`) never touches checkpoint/journal data — it was
   already unblocked at the data layer before this change, just not
   exposed as a command. `openspec-ui.rollbackChange` takes a
   `ChangeTreeItem` from either the Changes or Archive tree, no
   archived-state guard.
4. **Retention is opt-in, off by default.** `openspec-ui.checkpointRetentionDays`
   (VS Code setting; `0` or negative — the default — keeps checkpoint/
   process history forever, unchanged from every prior version). A
   positive value prunes processes/checkpoints older than N days once, on
   the next extension activation, via `WorkbenchProcessScheduler.removeBefore`.
   Pruning a process makes Rollback (single-process and whole-Change)
   permanently unavailable for it — this is disclosed in the setting's
   own description and in the extension README, not silent.
5. **Scoped to the VS Code extension for this first pass.** The
   automatic on-activation pruning has no standalone-app equivalent (the
   standalone server has no settings/config system to read a retention
   value from); `WorkbenchRecoveryService.rollbackChange` exists in core
   and is exposed over REST for API completeness, but nothing calls it
   automatically outside VS Code. Same pattern already used by
   `repo-bootstrap-snippets`.

## Rejected Alternatives

### SQLite-backed per-task diff store

See point 2 above — rejected on both the attribution problem (unsolved
by a storage change) and the dependency-risk/philosophy mismatch with
the rest of this codebase.

### Warn-and-restore-anyway on rollback conflict

Rejected — every other rollback path in this codebase (`rollbackCheckpoint`,
and now `rollbackChangeCheckpoints`) refuses the entire restore on any
conflict. A permissive exception for this one path would be a surprising,
undocumented inconsistency.

### Automatic retention pruning in the standalone server too

Rejected for this pass — the standalone server has no persistent
settings mechanism to source a retention value from, and building one
is out of scope for what was actually asked (a VS Code setting).

## Consequences

- Rollback's mental model becomes "per-process" and "per-Change" (not
  per-task) — simpler than task-scoped rollback would have been, at the
  cost of not being able to undo a single task's contribution in
  isolation when multiple tasks were touched by the same process run.
- No new dependency, no new persisted data shape — `rollbackChangeCheckpoints`
  is pure aggregation over the existing checkpoint format.
- Checkpoint/process history still grows unboundedly by default, exactly
  as before this change; operators who want bounded growth must opt in
  explicitly via `openspec-ui.checkpointRetentionDays` and accept the
  Rollback-availability trade-off that comes with it.
