# Design

## Decisions

### Snapshot capture at spawn

`spawnAndStream` and the ACP session driver already own the child handle and
its `pid`. After spawn they call one synchronous ledger writer. The snapshot is:

```
runId, pid, startTime, executablePath, hostname, cwd, changeName, commandLineHash
```

`commandLineHash = sha256(executable + " " + args.join(" "))`. The raw command
line is never persisted because arguments can carry a prompt or a secret.
`startTime` comes from the operating system: `Win32_Process.CreationDate` on
Windows, `/proc/<pid>/stat` field 22 plus boot time on Linux, `ps -o lstart`
on macOS. A start-time read that fails records `startTimeUnavailable` rather
than guessing, and the process is then only eligible for kill after a live
re-read succeeds and matches.

### Durable placement

The ledger lives outside the checkout, keyed by canonical repository identity
and hostname, using the same atomic write-then-rename discipline as the
compliance store and workspace lease. PID is per-machine, so hostname is part
of the key. Records are bounded: the newest N processes per host are retained,
and exited records older than a retention window are pruned.

### Kill safety

Kill is allowed only when the live OS snapshot matches the recorded one:
the PID is still alive, its start time equals the snapshot start time, and the
hostname matches. The executable is kept as recorded evidence. A mismatch is
reported as PID reuse and is never terminated. Termination always uses
`terminateProcessTree`, which on Windows runs `taskkill /T /F` and on POSIX
kills the process group.

### Compliance is read-only

A `process-overdue` rule maps a snapshot to an expected maximum duration and
reports a finding when exceeded, and an orphan finding when a record has no
exit time and no live writer. Neither rule mutates a process. Settings follow
the existing global/topic/rule tracking and reaction model, but this rule has
no repair implementation, so `autorepair` resolves to advice.

### Recovery owns the kill

The existing recovery/processes surface lists ledger-backed processes with
snapshot evidence and a `Terminate` action. The action shows the process tree
it will terminate, requires confirmation, re-reads the snapshot, and only then
calls `terminateProcessTree`. Background Compliance never terminates.

## Non-Goals

- No Windows Job Object in this pass; `KILL_ON_JOB_CLOSE` is a follow-up.
- No reading of a foreign process's environment or attempts to rename a process.
- No automatic termination and no Compliance repair for process findings.

## Risks / Trade-offs

- Start-time reads are subprocess calls and are performed at spawn and at
  kill, not in background Compliance sweeps.
- On some systems a foreign or elevated process may not expose start time;
  the ledger fails closed and refuses the kill.
- PID reuse between snapshot and re-verification is the reason for the live
  re-read, but it cannot be eliminated entirely; the hostname/executable/start
  time triple makes a false positive negligible.
- Writing at spawn adds latency to every run; the write is small and local.
