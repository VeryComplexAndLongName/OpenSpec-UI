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
