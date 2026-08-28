# 0010: Cross-Host Workspace Lease (Advisory Lock, v1)

Status: Proposed

Date: 2026-08-28

## Context

ADR 0004 decision 4 requires the Workbench to run at most one mutating
process per workspace until mutations are isolated by worktrees. That
invariant is enforced entirely in-memory: `WorkbenchProcessScheduler`
(`packages/core/src/process-scheduler.ts`) holds a private
`mutationLocked` boolean per instance, and `WorkbenchRunJournal`
(`packages/core/src/workbench-run-journal.ts`) serializes writes with a
private `writeQueue` promise chain per instance. Both are scoped to one
process's one instance.

ADR 0001 decision 2 keeps the local server available as an optional
transport alongside the VS Code extension's direct-import default "when
standalone UI parity is more important than localhost lifecycle
simplicity." That means the same workspace root can legitimately be open
in two separate Node processes at once: a VS Code extension host and a
standalone server. Each constructs its own `WorkbenchProcessScheduler`
and `WorkbenchRunJournal` for that root (`packages/extension/src/
extension.ts` activate(); `packages/core/src/workbench-recovery.ts`
`WorkbenchRecoveryService.open()`, used by `packages/server/src/
server.ts`'s `resolveRecoveryService`). Neither process is aware of the
other's in-memory mutation lock, and the journal's write-then-rename
replacement (ADR 0004 decision 1) prevents a torn write but not a lost
update: whichever process calls `journal.save()` last overwrites the
file with only its own in-memory view of process history, discarding
whatever the other process recorded concurrently.

Separately, review of the wire boundary found `packages/server/src/
wire.ts`'s `COMMAND_KINDS` array hand-duplicating `CommandKind` from
`packages/core/src/protocol.ts` (the one place ADR 0001 decision 3
designates as the protocol's source of truth). A new command kind added
to core silently fails server-side shape validation until someone
remembers to update the copy in `wire.ts`.

## Decision

1. **A workspace-local lease file, not a wider protocol version.** Core
   owns a versioned lease document at
   `<workspaceRoot>/.openspec-ui/workspace.lease.json`, written with the
   same write-then-rename atomic replacement the journal already uses
   (ADR 0004 decision 1). It records a random per-activation holder id,
   a host kind (`vscode-extension` / `standalone-server`), hostname,
   pid, and a heartbeat timestamp.
2. **The lease is acquired only around a mutating run, not for the
   lifetime of a host.** A host attempts to acquire or renew the lease
   exactly where `WorkbenchProcessScheduler.run()` already sets
   `mutationLocked = true`, and releases it in the same `finally` block
   that clears it today. Read-only processes never consult the lease,
   matching the existing "read-only runs remain concurrent" behavior
   unchanged.
3. **Rejection is immediate, not queued.** If another host's lease is
   present and not stale, the requesting host's mutating run fails right
   away with a `failed` process record naming the other host (kind,
   hostname, pid, how long since its last heartbeat) — it does not sit
   queued the way two same-process mutating runs do today, because the
   other host may hold the workspace indefinitely and the user should
   decide, not wait silently.
4. **Staleness, not liveness, governs reclamation.** The lease has no way
   to know whether its holder crashed. A heartbeat renewed periodically
   while a mutating run is active is compared against a fixed staleness
   window (a small constant multiple of the heartbeat interval); a host
   whose lease has gone stale is treated as no longer active, and the
   next host to request a mutating run reclaims the lease and surfaces
   that reclamation to the user rather than reporting it as a normal
   acquisition.
5. **Optional, backward-compatible integration.** `WorkbenchProcessScheduler`
   accepts an optional lease dependency; when absent (every existing unit
   test that constructs it with no workspace root) its behavior is
   exactly what it is today — in-memory only, no filesystem access. Both
   `WorkbenchRecoveryService.open()` and the extension's `activate()`
   construct and pass one when a real workspace root is available.
6. **Fix the wire contract duplication as part of the same change.**
   `packages/core/src/protocol.ts` exports the `CommandKind` list as a
   runtime array (`COMMAND_KINDS`); `packages/server/src/wire.ts` imports
   it instead of declaring its own copy. This is not a protocol shape
   change and needs no version bump — it removes a manual-sync hazard
   discovered while researching this ADR's own scope, in the same files
   this change already touches.

## Rejected Alternatives

### Full revision/CAS journal merge with an observer mode for the second host

Rejected for v1. The actually hard part — merging two hosts' concurrent
edits to the same process list, and a live read-only view for a host
that isn't the lease holder — has no existing consumer yet: nothing in
either delivery target today lets a user watch another host's run in
progress. Building a merge algorithm and a UI concept that doesn't exist
anywhere else in this codebase is a materially larger change than the
lost-update problem actually in front of us, which a single-mutator
lease already closes. Revisit if a real workflow needs two hosts
mutating the same workspace concurrently, not just one active and one
blocked.

### `protocolVersion` / capability handshake between hosts

Rejected for v1. This matters once hosts running genuinely different
released versions are expected to interoperate against the same lease
and journal. The lease document is versioned exactly like the journal
(ADR 0004 decision 1), and the common case — one user, one checkout,
two host processes — has both hosts on the same package versions
already. A handshake with nothing on the other end to negotiate against
is speculative scope, not a fix for an observed gap.

### An OS-level file lock (`flock`/`proper-lockfile`) instead of an
application-level heartbeat lease

Rejected. This would add a new dependency and platform-specific locking
semantics (Windows advisory locks behave differently from POSIX flock)
to solve a problem the existing write-then-rename atomic-replace
pattern already solves at the storage layer for the journal. A
heartbeat lease file, versioned and atomically replaced the same way,
keeps the dependency-free philosophy ADR 0004 and ADR 0006 already
established, and needs no per-platform behavior to reason about.

### Queue the second host's mutating run until the lease frees, mirroring same-process queueing

Rejected. Same-process queueing works because the same scheduler
instance will eventually drain the queue when its own mutation lock
clears — that is guaranteed to happen. A lease held by a different,
independently-running host has no such guarantee: it might hold the
workspace for the rest of the day. Queuing indefinitely against another
process's unknown future would surprise a user who has no visibility
into why their run never starts; an immediate, actionable failure keeps
the same fail-fast philosophy the security model (ADR 0001 decision 4)
already uses elsewhere in this codebase.

## Consequences

- A second host opening the same workspace while another is actively
  mutating it gets a clear, immediate rejection naming the other host,
  instead of silently racing it or queuing forever.
- The "one mutating run per workspace" invariant from ADR 0004 now holds
  across host processes, not only within one — refining, not reopening,
  that decision.
- Recovery from a crashed (not merely slow) lease holder depends on the
  staleness window elapsing; a host that hangs without crashing blocks
  the other host for up to that window after it stops actually making
  progress.
- True concurrent mutation from two hosts is still out of scope — that
  remains the worktree-isolation work ADR 0004 already named as the
  eventual path, tracked separately and orthogonally to this ADR.
- `WorkbenchProcessScheduler`'s internal control flow around `run()`
  gains an asynchronous gate for mutating processes only; read-only
  scheduling stays synchronous and unaffected.
