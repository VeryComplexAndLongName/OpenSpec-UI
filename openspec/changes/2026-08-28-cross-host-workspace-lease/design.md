## Context

Researched directly against this codebase (see ADR 0010 for the fuller
citation trail): `WorkbenchProcessScheduler.mutationLocked`
(`process-scheduler.ts:54`) and `WorkbenchRunJournal.writeQueue`
(`workbench-run-journal.ts:74`) are both private fields of one
in-process instance. Two construction sites exist for the same
workspace root: `packages/extension/src/extension.ts` `activate()`
builds a journal + scheduler pair directly; `packages/core/src/
workbench-recovery.ts` `WorkbenchRecoveryService.open()`/`initialize()`
builds its own pair internally and is the one `packages/server/src/
server.ts`'s `resolveRecoveryService` uses. Every existing scheduler
unit test (`process-scheduler.test.ts`, `implementation-sessions.test.ts`)
constructs `new WorkbenchProcessScheduler()` or
`new WorkbenchProcessScheduler([...])` with a single positional array
argument and no real filesystem workspace.

**Discovered mid-implementation:** `WorkbenchRecoveryService`'s scheduler,
as originally wired, was never actually reachable from the standalone
server's live command execution. `packages/server/src/websocket.ts`'s
`streamRun` called `runner.run(command)` directly for every command kind
— `WorkbenchRecoveryService.list()`/`rollback()`/`cleanupBefore()` only
ever read/mutated a scheduler populated from whatever the journal file
already contained. A lease wired only into that scheduler would have
protected `WorkbenchRecoveryService`'s own rollback/cleanup calls, but not
the actual "someone clicks Implement in the browser" case — the realistic
cross-host race ADR 0010 exists for. See ADR 0010's Context for the fuller
account; this design was extended (not restarted) once that was found.

## Goals / Non-Goals

**Goals:**
- Two host processes open on the same workspace root can never both
  believe they are the sole mutator at the same time.
- A rejected mutating run tells the user which other host is holding the
  workspace, not just that it failed.
- No existing scheduler/journal test needs a workspace root or lease
  fixture it doesn't already have — the lease is additive and optional.
- Reuse the journal's write-then-rename atomic replacement pattern
  exactly; no new dependency.
- The standalone server's own live `implement` execution is actually
  gated — not only `WorkbenchRecoveryService`'s rollback/cleanup calls,
  which were never the realistic contention point.

**Non-Goals:**
- Not merging concurrent journal writes from two hosts (revision/CAS) —
  the lease prevents two hosts from mutating concurrently in the first
  place, so there is nothing to merge for v1.
- Not building an "observer mode" live view of another host's active
  run — a rejected host still reads the journal exactly as it does
  today (a static snapshot at its own last load), just refused a new
  mutating run.
- Not adding a `protocolVersion`/capability handshake — see ADR 0010's
  rejected alternatives.
- Not making the lease's staleness window user-configurable — it is an
  internal constant for this iteration, not a new setting.
- Not covering true concurrent mutation from two hosts — that is the
  separately tracked worktree-isolation work ADR 0004 already named.
- Not adding checkpoint capture to the standalone server's WS-driven
  `implement` path. Those runs gain mutation exclusivity from this
  change but still have no rollback and are not recoverable as
  `interrupted` after a crash — a pre-existing, separate gap this
  change narrows (adds locking) but does not close (still no checkpoint).

## Decisions

### Gate only the mutating branch of `run()`, not scheduler construction or read-only processes

`canRun()`/`drain()` stay synchronous and untouched for read-only
processes. Only the mutating branch of `run()` — where
`mutationLocked = true` is set today — becomes asynchronous, acquiring
or renewing the lease before proceeding. This is the smallest change
that closes the actual gap (two hosts each racing to mutate), and
matches ADR 0004's existing distinction that read-only runs are never
subject to the mutation lock.

### Reject immediately as a `failed` process, not a queued wait or a synchronous throw

Two options were considered for how a blocked mutating run surfaces:
queue it the way two same-process mutating runs queue against each
other, or throw synchronously the way `start()` already does for a
duplicate id. Both are rejected — see ADR 0010's "queue the second
host" rejection for why indefinite queuing is wrong, and a synchronous
throw would require special-case handling everywhere `start()` is
called, unlike every other terminal outcome this scheduler already
models as a `WorkbenchProcess` state. Instead, the process is created
exactly as today, transitions straight to `running` is skipped, and it
finishes in the `failed` state with `error` naming the other host
(`hostKind`, `hostname`, `pid`, and how long since its last heartbeat).
This reuses the Processes UI both hosts already have for surfacing
failures, with no new UI concept.

### Lease acquisition is scoped to the mutating run's lifetime, not the host's

The lease is acquired when a mutating `run()` begins and released in the
same `finally` block that already flips `mutationLocked = false`. A host
that never starts a mutating run never touches the lease file at all —
this keeps a host that only ever reads (e.g. a `status`/`list` client)
from contending for a lease it doesn't need, and keeps the lease's
lifetime symmetric with the existing in-memory flag it extends across
processes.

### Lease document shape and file location

```ts
interface WorkspaceLeaseDocument {
  version: 1;
  holderId: string;   // randomUUID, one per scheduler-with-lease instance
  hostKind: "vscode-extension" | "standalone-server";
  hostname: string;
  pid: number;
  acquiredAt: string;  // ISO 8601
  heartbeatAt: string; // ISO 8601, renewed while the mutating run is active
}
```

Stored at `<workspaceRoot>/.openspec-ui/workspace.lease.json`, next to
`workbench-runs.json`, using the exact write-then-rename-with-EEXIST/EPERM-retry
sequence `WorkbenchRunJournal.write()` already implements — not a second,
subtly different atomic-write implementation.

### Heartbeat interval and staleness window are fixed constants

A mutating run renews the lease heartbeat every 5 seconds while active;
a lease is considered stale once its `heartbeatAt` is more than 20
seconds old (4x the interval — tolerant of a slow disk or a GC pause
without being so wide that a genuinely crashed host blocks the other one
for long). These are internal constants for this iteration (see
Non-Goals); a future change can expose them if real usage shows the
defaults are wrong.

### `WorkspaceLeaseManager` is a new core module, injected — not baked into `WorkbenchProcessScheduler`'s constructor signature as a required argument

Making the lease mandatory would force every existing scheduler test
(`process-scheduler.test.ts`, `implementation-sessions.test.ts`) to set
up a temp directory and a real lease file just to exercise unrelated
queue-ordering behavior that has nothing to do with cross-host
concurrency. An optional second constructor parameter, defaulting to a
no-op in-memory-only behavior when absent, keeps every current call site
and test compiling and passing unchanged, and matches how
`WorkbenchRunJournalOptions` is already optional on the journal side.

### Route only `implement` through the scheduler on the WS path; every other command kind is untouched

`packages/server/src/websocket.ts`'s `streamRun` branches on
`command.kind !== "implement"` first: every other kind (`plan`, `review`,
`status`, `list`, `show`, `validate`, `cancel`) keeps calling
`runner.run(command)` directly, unchanged. Only `implement` — the one
`mutating: true` operation, matching `ImplementationSessionManager`'s own
convention — goes through `WorkbenchRecoveryService.runMutating()`. This
mirrors the extension's existing asymmetry (only `implement` sessions are
scheduler-gated there either) rather than inventing a new rule for the
server.

### `WorkbenchRecoveryService.runMutating()` is a thin pass-through, not a checkpoint-capturing wrapper

It calls `scheduler.start({ ..., mutating: true, execute })` and, once
`execute` finishes, calls the same private `persist()` every rollback/
cleanup call already uses — so a terminal (`completed`/`failed`)
`implement` run becomes visible in `list()`/the journal like any other,
without adding checkpoint capture. There is deliberately no
`scheduler.onDidChange` auto-persist wiring added for this: `initialize()`
and `cleanupBefore()` both reassign `this.scheduler` to a new instance,
and re-subscribing a listener across those reassignments is exactly the
kind of retrofit checkpoint capture would also need — out of scope here
(see Non-Goals). Consequence: a server crash strictly *during* a WS-driven
`implement` run leaves no persisted trace of it (not even as
`interrupted`) — only genuinely-finished runs are recorded. Narrower than
the extension's own crash coverage, and disclosed as such rather than
silently assumed away.

### Detecting a lease-blocked run without adding a new `Event` kind

When the lease blocks a mutating run, `execute` never runs, so nothing
was ever sent to the client for that attempt — but `websocket.ts` needs
to tell the client the run failed. Rather than teaching
`WorkbenchRecoveryService` to talk WebSocket, `streamRun` inspects the
returned `WorkbenchProcess` itself: `state === "failed" && startedAt ===
undefined` is exactly the signature of the early-exit path in
`process-scheduler.ts`'s `run()` (a normal in-`execute` failure always
sets `startedAt` first). `streamRun` then synthesizes one `failed` `Event`
from `process.error`. No protocol change, no new `EventKind` — reuses the
existing `failed` variant precisely as `agent-runner.ts` already does for
its own internal errors.

## Risks / Trade-offs

- **[Risk]** Introducing an asynchronous gate into `WorkbenchProcessScheduler.run()`
  changes its internal control flow for the mutating branch only;
  `drain()`'s synchronous iteration and the read-only path must not
  regress. → **Mitigation**: this is the one piece of the change with
  real implementation risk and needs explicit before/after test coverage
  on `canRun`/`drain`/`run` ordering (task 4.1), not just the new
  cross-host scenarios.
- **[Risk]** A host that hangs without crashing (deadlocked, not
  terminated) still holds a live-looking lease and blocks the other host
  for up to the staleness window after it stops making real progress —
  same trade-off ADR 0010 already accepts explicitly.
- **[Risk]** Clock skew between two machines is not a concern here
  (single-machine, two local processes, per ADR 0001/0005's local-only
  transport model), but a suspended VM or a system sleep/resume could
  make a heartbeat appear stale prematurely. → **Mitigation**: reclaiming
  a stale lease is always disclosed to the user (never silent), so a
  false reclamation is visible and recoverable, not a silent data-loss
  event.
- **[Risk]** `.openspec-ui/workspace.lease.json` becoming stale garbage
  after an unclean host exit is expected, not a bug — the next mutating
  run's staleness check cleans it up functionally (overwrites it) even
  though the file itself isn't deleted proactively.
- **[Realized during implementation]** `packages/server/src/server.test.ts`'s
  existing WS `implement` tests used a fake, non-real `cwd`
  (`/workspace/repo`) — harmless before this change, since nothing
  touched the filesystem for that path. Once `implement` started routing
  through `WorkbenchRecoveryService.open(command.cwd)`, the same tests
  silently created real files at `C:\workspace\repo\.openspec-ui\`,
  outside any temp-directory sandbox and outside `afterEach`'s cleanup.
  Fixed by giving those specific tests a real, tracked temp workspace
  (task 5.4) — flagged here as a reminder that any *other* test
  exercising the WS `implement` path with a placeholder `cwd` needs the
  same fix, not just the ones this change happened to touch.
