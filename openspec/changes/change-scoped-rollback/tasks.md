## 1. Core: aggregated restore primitive

- [x] 1.1 `checkpoint.ts`: `RestoreEntry`, `restoreFiles()` (shared
  conflict-check/restore loop); `rollbackCheckpoint()` refactored to
  build entries from a single checkpoint and delegate — behavior
  unchanged, confirmed by the pre-existing tests still passing unmodified.
  `rollbackChangeCheckpoints()` aggregates a list of finalized
  checkpoints: earliest-before per file, latest-afterHash per file for
  the conflict check.
- [x] 1.2 `checkpoint.test.ts`: multi-checkpoint aggregation (earliest
  wins for restore target, order-independent), conflict refuses the
  whole restore, empty-list and not-finalized error cases. 9/9 core
  checkpoint tests passing (4 pre-existing + 5 new).

## 2. Core: WorkbenchRecoveryService (server/standalone)

- [x] 2.1 `workbench-recovery.ts`: `changeRollbackCandidates()` (private,
  shared by both new methods — active or archived, no archive-status
  check since archiving never touches this data), `changeRollbackDetails()`
  (process/file-count preview), `rollbackChange()`.
- [x] 2.2 `workbench-recovery.test.ts`: rolls back two processes for one
  Change across two checkpoints to the earliest state; throws for a
  Change with nothing eligible. 5/5 passing (3 pre-existing + 2 new).

## 3. Core: WorkbenchProcessScheduler retention primitive

- [x] 3.1 `process-scheduler.ts`: `removeBefore(cutoff)` — in-place Map
  mutation (not instance replacement, unlike
  `WorkbenchRecoveryService.cleanupBefore`), because the extension's
  scheduler instance is captured by reference across several tree
  providers and the chat participant.
- [x] 3.2 `process-scheduler.test.ts`: drops only processes created
  before the cutoff, in place. 6/6 passing (5 pre-existing + 1 new).

## 4. Extension: ImplementationSessionManager mirror

- [x] 4.1 `implementation-sessions.ts`: `changeRollbackCandidates()`
  (private), `changeRollbackDetails()`, `rollbackChange()` — same
  eligibility rule and aggregation as core's mirror, duplicated here
  because the extension's primary mode keeps its own session map instead
  of going through `WorkbenchRecoveryService`. `dropSessions()` for
  retention pruning.
- [x] 4.2 `implementation-sessions.test.ts`: rolls back two runs for one
  Change to the earliest state; throws when nothing eligible;
  `dropSessions` removes a session from participating in later rollback
  calls. 6/6 passing (3 pre-existing + 3 new).

## 5. Extension: command, menu, retention setting

- [x] 5.1 `commands.ts`: `openspec-ui.rollbackChange` — takes a
  `ChangeTreeItem` from either tree, previews via
  `changeRollbackDetails`, confirms, calls `rollbackChange`, same
  conflict/error handling pattern as `openspec-ui.rollbackProcess`.
- [x] 5.2 `package.json`: command registration; context-menu entries for
  both `openspec-ui.activeChange` and `openspec-ui.archivedChange`
  (single `when` clause, same pattern as `deleteChange`);
  `openspec-ui.checkpointRetentionDays` configuration property (default
  `0`, description discloses the Rollback-availability consequence of
  pruning).
- [x] 5.3 `extension.ts`: reads the setting after
  `implementationSessions.restore()`; if positive, computes the cutoff
  and calls `scheduler.removeBefore()` + `implementationSessions.dropSessions()`.
  Relies on the already-registered `scheduler.onDidChange(persistRuns)`
  subscription to persist the pruned state — no separate persist call.
- [x] 5.4 `commands.test.ts`: 5 new tests for `openspec-ui.rollbackChange`
  (confirmed rollback, no-eligible-processes reporting without a
  confirmation prompt, declined confirmation, conflict reporting, works
  identically for an archived item). Extended `makeDeps()`'s
  `implementationSessions` mock with `changeRollbackDetails`/
  `rollbackChange`. 46/46 extension command tests passing.

## 6. Server: REST parity (no automatic pruning, no new webui UI)

- [x] 6.1 `recovery-rest.ts`: `handleChangeRollbackRequest` — `POST
  /api/processes/rollback-change`, body `{ cwd, changeName }`, same
  authorization/cwd-policy pattern as the existing per-process rollback
  handler.
- [x] 6.2 `server.ts`: route registration.
- [x] 6.3 `server.test.ts`: real end-to-end test — two real checkpoints
  captured/finalized against a real temp workspace, seeded into a real
  journal, `POST /api/processes/rollback-change` restores to the
  earliest state. 33/33 server tests passing.
- [x] 6.4 No standalone webui button and no automatic retention pruning
  on the server in this pass — documented as a deliberate scope decision
  in `proposal.md`, matching the `repo-bootstrap-snippets` precedent.

## 7. Docs, ADR, verification, versioning, smoke test

- [x] 7.1 `docs/adr/0008-change-scoped-rollback-and-retention.md` — the
  SQLite-per-task-diff proposal, the fail-closed-vs-warn-and-restore
  question, and the retention-scope decision, all recorded with their
  reasoning.
- [x] 7.2 `packages/extension/README.md`: Features bullet for "Rollback
  Change"; Settings section entry for
  `openspec-ui.checkpointRetentionDays` with an explicit **Warning** that
  pruned processes lose Rollback availability permanently and that the
  default is to keep everything forever (per user's explicit
  documentation request).
- [x] 7.3 `npm run typecheck && npm run lint && npm run test` passes for
  `packages/core` (162/162), `packages/server` (39/39),
  `packages/extension` (97/97). Re-run `npm run verify` after
  `git add`/commit of all new files.
- [x] 7.4 Bumped `package.json` versions (minor — new capability, no
  contract break): `@openspec-ui/core` 0.18.0 → 0.19.0, `openspec-ui-vscode`
  0.12.1 → 0.14.0 (0.13.0 deliberately skipped — already claimed by the
  concurrent `repo-bootstrap-tree-ui` branch/PR, to avoid an entirely
  foreseeable version collision), `@openspec-ui/server` 1.7.0 → 1.8.0.
  Extension `CHANGELOG.md` entry, root `README.md` version table.
- [x] 7.5 Manual smoke test: real Extension Host run
  (`npm run test:integration`, 6/6 passing); real temp-workspace check
  via `tsx` with two sequential real checkpoints against real files —
  `rollbackChangeCheckpoints` correctly restored `v2` back to `v0`, not
  through mocks. Server-side real end-to-end coverage also added in
  `server.test.ts` (task 6.3).
- [x] 7.6 `openspec change validate --strict change-scoped-rollback`
  passes.
