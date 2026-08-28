## 1. Core: workspace lease module

- [ ] 1.1 Add `packages/core/src/workspace-lease.ts`: `WorkspaceLeaseDocument`
  (version 1, `holderId`/`hostKind`/`hostname`/`pid`/`acquiredAt`/`heartbeatAt`)
  and a `WorkspaceLeaseManager` class reading/writing
  `<root>/.openspec-ui/workspace.lease.json` via write-then-rename atomic
  replacement, mirroring `WorkbenchRunJournal.write()`'s
  temp-file-then-rename-with-EEXIST/EPERM-retry sequence exactly (not a
  second, independent implementation).
- [ ] 1.2 `WorkspaceLeaseManager.acquireOrRenew()`: succeeds if no lease
  exists, the existing lease belongs to this manager's own `holderId`, or
  the existing lease's `heartbeatAt` is older than the staleness window
  (20s); otherwise returns the current holder's details without writing.
- [ ] 1.3 `WorkspaceLeaseManager.release()`: clears the lease file only if
  it is currently held by this manager's own `holderId`.
- [ ] 1.4 Export `WorkspaceLeaseManager` and its types from
  `packages/core/src/index.ts`.

## 2. Core: scheduler integration

- [ ] 2.1 `WorkbenchProcessScheduler`'s constructor accepts an optional
  second parameter carrying a lease manager; omitted, behavior is
  unchanged from today (in-memory `mutationLocked` only, no filesystem
  access) — every existing call site and test keeps compiling and
  passing with no changes.
- [ ] 2.2 In `run()`'s mutating branch, before setting
  `mutationLocked = true`: if a lease manager is present, call
  `acquireOrRenew()`. If it reports another live holder, finish the
  process as `failed` immediately (never transitioning through
  `running`), with `error` naming the other host's `hostKind`/`hostname`/
  `pid` and time since its last heartbeat — do not queue it.
- [ ] 2.3 While a mutating process is `running` under a lease manager,
  renew the lease every 5s until the process finishes.
- [ ] 2.4 In the mutating branch's existing `finally` block (alongside
  `mutationLocked = false`), release the lease if one was acquired.
- [ ] 2.5 When `acquireOrRenew()` reclaims a stale lease from a different
  `holderId`, surface that reclamation (not a plain acquisition) through
  the existing `report`/progress channel so the host can disclose it.

## 3. Host wiring

- [ ] 3.1 `WorkbenchRecoveryService.open()`
  (`packages/core/src/workbench-recovery.ts`) constructs a
  `WorkspaceLeaseManager` for `root` with `hostKind: "standalone-server"`
  and passes it to its internal scheduler (`initialize()` and
  `cleanupBefore()`'s scheduler reconstruction).
- [ ] 3.2 `packages/extension/src/extension.ts` `activate()` constructs a
  `WorkspaceLeaseManager` for `workspaceRoot` with
  `hostKind: "vscode-extension"` (only when `workspaceRoot` is defined,
  matching the existing journal-construction guard) and passes it to the
  scheduler it constructs directly.
- [ ] 3.3 Confirm `deactivate()` (`extension.ts:206`) and the standalone
  server's `close()` (`packages/server/src/server.ts:268`) do not need to
  release a lease themselves — release already happens per-run in the
  scheduler's `finally` block (2.4), so no lease is ever held across a
  clean shutdown with no active mutating run.

## 4. Wire contract fix

- [ ] 4.1 Export `COMMAND_KINDS` (a `readonly CommandKind[]`) from
  `packages/core/src/protocol.ts`, next to the `CommandKind` type it
  enumerates.
- [ ] 4.2 `packages/server/src/wire.ts`'s `isCommandLike` imports and uses
  that exported array instead of its own locally declared
  `COMMAND_KINDS`.

## 5. Tests

- [ ] 5.1 `workspace-lease.test.ts`: acquire when absent, renew by the
  same holder, refuse a live foreign holder, reclaim a stale foreign
  holder, release only when self-held, and the write-then-rename
  replacement survives a concurrent read (mirroring
  `workbench-run-journal.test.ts`'s existing atomicity coverage style).
- [ ] 5.2 `process-scheduler.test.ts`: add cases for a lease-backed
  scheduler — foreign live lease rejects a mutating run as `failed`
  without queuing; own or absent lease behaves exactly as before; stale
  foreign lease is reclaimed and disclosed. Explicitly re-run the
  existing no-lease test cases unchanged to confirm the optional
  parameter is truly backward compatible (risk called out in design.md).
- [ ] 5.3 A cross-process integration test: two `WorkbenchRecoveryService`
  instances (or scheduler + lease manager pairs) opened against the same
  temp workspace root in the same test process, simulating two hosts —
  confirms the second cannot start a mutating run while the first's
  lease is live, and can once the first finishes or its lease goes
  stale.
- [ ] 5.4 `wire.test.ts` (or equivalent): `isCommandLike` still accepts
  every `CommandKind`, now sourced from the shared `COMMAND_KINDS` export
  rather than a local copy.

## 6. Verification

- [ ] 6.1 `npm run typecheck` and `npm run lint` (including
  `lint:english`) pass workspace-wide.
- [ ] 6.2 `npm run test` passes workspace-wide, including the new
  `workspace-lease.test.ts`, the extended `process-scheduler.test.ts`,
  and `wire.test.ts`.
- [ ] 6.3 Manual smoke test: start the standalone server and the VS Code
  extension against the same real workspace; start a mutating run
  (`implement`) from one, confirm the other's attempt to start a
  mutating run fails immediately naming the first host; let the first
  finish and confirm the second can then run.
- [ ] 6.4 Propose a changeset (`npx changeset`) for `@openspec-ui/core`
  (new lease behavior), `@openspec-ui/server`, and
  `openspec-ui-vscode` (minor: new capability, no breaking change).
- [ ] 6.5 Run `openspec change validate --strict cross-host-workspace-lease`.
