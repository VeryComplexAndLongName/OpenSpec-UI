# A status write never stops a run

## Why

`what-the-others-are-doing` 7.5 put a real second agent in a second
working directory on Windows. About fifteen seconds into its apply stage,
`openspec-ui-cli run` died:

```
Error: EPERM: operation not permitted, rename '<id>.json.<uuid>.tmp' -> '<id>.json'
    at async AgentStatusWriter.write
run exit=1
```

The run was doing nothing wrong. The record that says what it is doing
ended it. Three things in `AgentStatusWriter` combine:

- The heartbeat renews the record from a timer as `void this.write()`.
  Nothing handles its rejection, and Node ends the process on an
  unhandled one. A write made for an event is guarded — `withAgentStatus`
  catches it — the timer's is not.
- Writes are not taken one at a time. A renewal can fall due while an
  activity write is under way, and both rename a temporary file onto the
  same name at once.
- On Windows a rename onto a name that is momentarily in use fails with
  `EPERM`. The fallback removes the record and renames again; that second
  rename is the one that failed, and its error escaped.

ADR 0028 made the record a diagnostic about a run. A diagnostic that can
end what it describes is worse than none. Every Harness run on Windows
carries the risk — the CLI, the standalone server and VS Code all wrap
runs in `withAgentStatus` — and nothing on screen connects the failure to
the record.

## What Changes

- **Reporting never ends a run.** No failure to write, renew or remove a
  record reaches the run: not as a thrown error, not as an unhandled
  rejection.
- **One write at a time per record.** Renewals and activity writes queue
  behind each other.
- **A refused replace is retried, not made room for.** A rename refused
  as in use is retried a few times with a short pause. The record is no
  longer removed to make room: removing it left a live run briefly without
  a record, and did not help while the name was in use. A write that still
  cannot land is dropped; the previous record stands and the next renewal
  tries again.
- **A clean stop waits for a write under way.** Otherwise a write started
  before `stop()` can put the record back after it was removed, and a
  finished run reads as running, then as gone.

## Impact

- `packages/core` — `agent-status.ts` only. Every host gets the fix
  through `withAgentStatus`.
- No change to the record's shape, its directory, the staleness window,
  or the reader.
- ADR 0028 stands as written: a record is still written to a temporary
  name and renamed into place.

## Unblocks

`what-the-others-are-doing` 7.5, which needs a second agent's run to live
long enough to be compared with what `openspec-ui-cli status` prints.

## Out of scope

- Removing records a crash left behind — `a-stale-status-is-swept`.
- What the same day turned up elsewhere: the delegated-item route reads
  only a bare agent id, loses a failed run's stderr, and writes no status
  record for its run; and the Pipeline tab shows no other directory until
  its own reading arrives. Each is its own change.
