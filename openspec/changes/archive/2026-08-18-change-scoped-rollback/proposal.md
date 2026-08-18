## Why

Two related gaps raised in review: (1) Rollback only targets one
process's checkpoint at a time — undoing a Change that took several
implement runs means finding and rolling back each one individually, in
the right order; (2) nothing in the UI offers Rollback for an already-
archived Change, even though archiving never actually touches
checkpoint/journal data (`archiveChange()` is a thin `openspec archive`
CLI wrapper scoped to `openspec/changes/`) — it was already unblocked at
the data layer, just never exposed as a command.

A task-scoped alternative (rolling back a single `tasks.md` checklist
item) was discussed and explicitly rejected — see ADR 0008 for the full
reasoning (attribution problem unsolved by storage choice; SQLite
dependency risk in a VS Code extension; fail-closed-vs-warn-and-proceed
philosophy mismatch).

Also closes a related, previously undiscussed gap: checkpoint/process
history has never had any retention mechanism in the VS Code extension
(the core `WorkbenchRecoveryService.cleanupBefore` exists but is only
reachable through the standalone server's REST API, which the extension
doesn't use in its primary direct-import mode) — now that Rollback
reaches further back in a Change's history, unbounded growth is worth
addressing with an explicit, opt-in setting.

## What Changes

- `packages/core/src/checkpoint.ts`: new `rollbackChangeCheckpoints()`
  aggregates every finalized checkpoint for a Change into one restore —
  each file's target is its content from the *earliest* checkpoint that
  touched it, conflict-checked against each file's *latest* known
  post-run hash. Same fail-closed, all-or-nothing semantics as
  single-process rollback. Refactored `rollbackCheckpoint()` to share the
  new `restoreFiles()` primitive instead of duplicating the conflict-
  check/restore loop (behavior-preserving).
- `packages/core/src/workbench-recovery.ts` (`WorkbenchRecoveryService`,
  used by the server/standalone) and `packages/extension/src/
  implementation-sessions.ts` (`ImplementationSessionManager`, used by
  the extension's primary direct-import mode) both gain
  `changeRollbackDetails(changeName)` (preview: process/file counts, for
  a confirmation prompt) and `rollbackChange(changeName)` (perform it),
  built on the shared core aggregation function.
- New `openspec-ui.rollbackChange` command, offered on a `ChangeTreeItem`
  from **either** the Changes or Archive tree (no archived-state guard —
  archiving never touched this data).
- New `openspec-ui.checkpointRetentionDays` VS Code setting (default `0`
  = keep forever, unchanged from every prior version). A positive value
  prunes processes/checkpoints older than N days once, on the next
  extension activation. `WorkbenchProcessScheduler` gains `removeBefore()`
  (in-place mutation, unlike `WorkbenchRecoveryService.cleanupBefore`'s
  whole-instance replacement — chosen because the extension's scheduler
  instance is shared by reference across several tree providers and the
  chat participant, so replacing it wholesale would require a bigger,
  unrelated refactor). Pruning makes Rollback permanently unavailable for
  the pruned process(es) — disclosed in the setting description and
  README, not silent.
- `packages/server/src/recovery-rest.ts`: `POST /api/processes/rollback-
  change` for API completeness/parity with the extension's capability —
  no new standalone UI button for it in this pass (see "Impact").

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `persistent-workbench-runs`: Rollback can now target an entire Change,
  not just one process; adds an opt-in, VS Code-only retention setting.
- `vscode-extension`: Changes and Archive trees offer a "Rollback Change"
  action.

## Impact

- `packages/core/src/checkpoint.ts` (`restoreFiles`, `RestoreEntry`,
  `rollbackChangeCheckpoints`), `checkpoint.test.ts`.
- `packages/core/src/workbench-recovery.ts` (`changeRollbackDetails`,
  `rollbackChange`), `workbench-recovery.test.ts`.
- `packages/core/src/process-scheduler.ts` (`removeBefore`),
  `process-scheduler.test.ts`.
- `packages/extension/src/implementation-sessions.ts`
  (`changeRollbackDetails`, `rollbackChange`, `dropSessions`),
  `implementation-sessions.test.ts`.
- `packages/extension/src/commands.ts` (`openspec-ui.rollbackChange`),
  `commands.test.ts`.
- `packages/extension/src/extension.ts` (retention pruning at
  activation, reading the new setting).
- `packages/extension/package.json` (command, context-menu entries on
  both `openspec-ui.activeChange`/`openspec-ui.archivedChange`,
  `openspec-ui.checkpointRetentionDays` configuration property).
- `packages/server/src/recovery-rest.ts`, `server.ts`,
  `recovery-rest.test.ts` (or `server.test.ts`, wherever the existing
  process-rollback endpoint is tested) — REST parity only, no automatic
  retention pruning on the server (no settings/config system to source a
  value from) and no new standalone webui button — deliberate scope
  decision for this pass, same pattern `repo-bootstrap-snippets` already
  used ("VS Code only for this first pass").
- `docs/adr/0008-change-scoped-rollback-and-retention.md` (new).
