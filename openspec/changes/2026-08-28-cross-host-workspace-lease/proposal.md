# Change: Cross-Host Workspace Lease

## Why

ADR 0004 decision 4 requires at most one mutating Workbench process per
workspace, but the enforcement is a private, per-instance boolean:
`WorkbenchProcessScheduler.mutationLocked`
(`packages/core/src/process-scheduler.ts:54`). `WorkbenchRunJournal`'s
write serialization (`writeQueue`,
`packages/core/src/workbench-run-journal.ts:74`) is equally
process-local. Both the VS Code extension (`packages/extension/src/
extension.ts` `activate()`) and the standalone server (`packages/core/
src/workbench-recovery.ts` `WorkbenchRecoveryService.open()`, used by
`packages/server/src/server.ts`) construct their own scheduler and
journal for the same workspace root — which ADR 0001 decision 2
explicitly allows to run at the same time as an optional transport
alongside the extension's direct-import default. Two hosts on the same
workspace can each believe they are the sole mutator and start
concurrent mutating runs, and whichever host's journal write lands last
silently discards the other host's recorded process history (a lost
update, not merely a torn write — write-then-rename already prevents
torn writes, per ADR 0004 decision 1).

Separately, `packages/server/src/wire.ts`'s `COMMAND_KINDS` array
duplicates `CommandKind` from `packages/core/src/protocol.ts:8`, the one
place ADR 0001 decision 3 designates as the command protocol's source of
truth — a new command kind added to core silently fails this
hand-maintained copy until someone remembers to update it.

See ADR 0010 for the full decision and rejected alternatives.

## What Changes

- Add `packages/core/src/workspace-lease.ts`: a versioned lease document
  at `<workspaceRoot>/.openspec-ui/workspace.lease.json` (write-then-rename
  atomic replacement, same pattern as `WorkbenchRunJournal`), recording a
  random per-activation holder id, host kind, hostname, pid, and a
  renewed heartbeat timestamp.
- `WorkbenchProcessScheduler` (`process-scheduler.ts`) accepts an
  optional lease dependency. When a mutating process is about to run, it
  attempts to acquire or renew the lease; when present and held by
  another, non-stale holder, the run fails immediately as `failed` with
  a reason naming the other host, instead of starting. The lease is
  released in the same `finally` block that already clears
  `mutationLocked`. Read-only processes are unaffected.
- `WorkbenchRecoveryService.open()` (`workbench-recovery.ts`) and the
  extension's `activate()` (`extension.ts`) each construct a
  `WorkspaceLeaseManager` for their real workspace root and pass it to
  their scheduler. No other call site changes: every existing test that
  constructs `WorkbenchProcessScheduler()` with no lease keeps its
  current in-memory-only behavior.
- Export `COMMAND_KINDS` from `packages/core/src/protocol.ts`;
  `packages/server/src/wire.ts` imports it instead of redeclaring the
  literal list.
- Add `docs/adr/0010-cross-host-workspace-lease.md`.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `persistent-workbench-runs`: extends "Workspace mutation isolation" to
  hold across host processes, not only within one, via the workspace
  lease.
- `execution-core`: adds a requirement that command kind validation has
  exactly one source of truth in core.

## Impact

- `packages/core/src/workspace-lease.ts` (new)
- `packages/core/src/process-scheduler.ts`
- `packages/core/src/protocol.ts`
- `packages/core/src/workbench-recovery.ts`
- `packages/core/src/index.ts` (export `WorkspaceLeaseManager`)
- `packages/server/src/wire.ts`
- `packages/extension/src/extension.ts`
- `docs/adr/0010-cross-host-workspace-lease.md` (new)
- `.changeset/*.md` (new changeset file)
