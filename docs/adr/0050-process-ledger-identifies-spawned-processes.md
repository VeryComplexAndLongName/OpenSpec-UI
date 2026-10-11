# 0050: A Process Ledger Identifies Spawned Processes

Status: Proposed

Date: 2026-10-11

## Context

The Workbench spawns agent CLIs and short Git/OpenSpec subprocesses through
`packages/core/src/agents/shared.ts` (`spawnAndStream`) and
`packages/core/src/agents/acp-session-driver.ts`. When a host stops
unexpectedly — a VS Code `Developer: Reload Window`, a crash — the Node
process that held the child handles is gone, but the child process trees can
survive. The host can no longer stop them through its own in-memory handles.
On Windows the `.cmd` shims make this worse: killing the shim without
`taskkill /T` leaves the real agent running.

The product already records run purpose and state (`WorkbenchProcessScheduler`,
`WorkbenchRecoveryService`, `WorkbenchRunJournal`, `FileAuditLog`) and can
terminate a process tree (`terminateProcessTree`). What is missing is a
durable record of the operating-system identity of each spawned process, so a
later host can recognise a process it started before a restart without
misidentifying a reused PID as its own.

## Decision

1. **A process ledger records each spawn synchronously.** At the moment a
   spawned child reports its PID, core writes a snapshot: run id, pid,
   operating-system process start time, executable path, hostname, working
   directory, change name where known, a SHA-256 hash of the command line,
   and the time the record was written. The command line itself is not stored.
2. **Identity is the operating-system snapshot.** `(pid, start time, executable,
   hostname)` identifies one process instance. The command-line hash is a
   compact, secret-free fingerprint, not a uniqueness guarantee.
3. **Normal exit updates the ledger.** When the spawned process closes, the
   record is marked with `exitedAt`. A record with no exit time and no live
   writer is orphaned or in progress.
4. **Kill is a re-verified, explicit action.** Before termination the caller
   reads the current OS start time for the PID and confirms the start time and
   hostname match the snapshot; the executable is kept as recorded evidence.
   A mismatch is PID reuse and is never killed. The kill uses the existing
   `terminateProcessTree`, not a PID-only signal.
5. **Compliance observes; it does not kill.** Orphaned or overdue processes
   surface as findings with advice. Termination happens in the existing
   recovery/processes surface with a confirmation naming the process tree.
6. **Overdue mapping is conservative.** A process without a known limit is
   reported, not presumed safe. Limits reuse the harness `timeout` where one
   exists and short defaults for known tool subprocesses.

## Rejected Alternatives

### Killing by persisted PID alone

Rejected because operating systems reuse PIDs. A stale PID can name an
unrelated process that must never be terminated.

### Renaming the process or reading another process's environment

Rejected because the OS image name is the executable file name, and reading a
foreign process's environment is unreliable on Windows. The snapshot identity
achieves the same outcome without those mechanisms.

### Compliance auto-repairing overdue processes

Rejected because terminating a process is irreversible. Compliance stays
advice-only; a person confirms a kill through the recovery surface.

### A Windows Job Object in this pass

Deferred to a follow-up. `KILL_ON_JOB_CLOSE` would make the OS reap a tree
when the host closes, but it requires native bindings and is Windows-only.

## Consequences

- Every spawn through the shared adapters gains one synchronous ledger write
  and, where needed, one OS start-time read.
- Orphaned trees become identifiable and terminable after a host restart.
- Storing command-line hashes avoids persisting prompts or secrets.
- Windows and Linux/macOS use different start-time sources but share one
  snapshot shape and one kill-reverification rule.
