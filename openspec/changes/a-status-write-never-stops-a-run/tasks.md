A second agent's run on Windows died from its own status record: the
heartbeat's write was refused with `EPERM`, nothing handled the
rejection, and Node ended the process. `what-the-others-are-doing` 7.5
waits on this.

## 1. One write at a time

- [ ] 1.1 `AgentStatusWriter` takes its writes one at a time: a renewal,
  an activity and a streamed activity queue behind whatever write is under
  way.
- [ ] 1.2 A queued write builds its document when it runs, so a renewal
  queued behind an activity write never puts back the older activity.
- [ ] 1.3 The queue survives a failed write: the next one still runs.

## 2. A refused replace

- [ ] 2.1 A rename refused with `EPERM`, `EACCES` or `EBUSY` is retried a
  bounded number of times with a short, growing pause, the whole well
  under `AGENT_STATUS_RENEW_INTERVAL_MS`.
- [ ] 2.2 The record is not removed to make room for a refused rename.
  Remove-then-rename stays only for `EEXIST`, where retrying cannot help.
- [ ] 2.3 A write that still cannot land is dropped: its temporary file is
  removed and the previous record stands.

## 3. Nothing reaches the run

- [ ] 3.1 The heartbeat timer's write can never reject unhandled.
- [ ] 3.2 `reportActivity` and `noteStreamedActivity` resolve when their
  write has landed or been dropped, and never reject.
- [ ] 3.3 `start()` still rejects when its first record cannot be written,
  so `startAgentStatus` leaves the run unreported, as today.
- [ ] 3.4 `stop()` waits for a write under way before removing the record,
  and no write lands after it.

## 4. Tests

- [ ] 4.1 A rename refused twice with `EPERM` and then allowed: the record
  is written and nothing rejects — through a file-operations seam the
  writer takes as an option, defaulting to `node:fs/promises`.
- [ ] 4.2 A rename that is always refused: `reportActivity` resolves, the
  previous record is still readable, and no temporary file is left.
- [ ] 4.3 A heartbeat whose write is always refused raises no unhandled
  rejection across several intervals, with fake timers; the suite fails
  on one.
- [ ] 4.4 A renewal falling due during a slow activity write: the file
  operations see two complete writes one after the other, never
  interleaved.
- [ ] 4.5 `stop()` called while a write is under way leaves no record.
- [ ] 4.6 The existing concurrent write-and-read test still passes.

## 5. Verification

- [ ] 5.1 This change validates strictly. `check(validate-change)`
- [ ] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts.
- [ ] 5.3 A pending changeset exists. `check(changeset-present)`
- [ ] 5.4 **Delegated to claude-cli**: on this Windows machine, start a
  real `openspec-ui-cli run` of a small fixture change in a second working
  directory, and read `openspec-ui-cli status` every second until the run
  ends. Evidence: the run's exit code and log, and the status output
  across the run. The unit tests refuse a rename on purpose; only a real
  run shows that a run survives whatever Windows actually does.
