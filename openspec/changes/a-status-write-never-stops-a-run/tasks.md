A second agent's run on Windows died from its own status record: the
heartbeat's write was refused with `EPERM`, nothing handled the
rejection, and Node ended the process. `what-the-others-are-doing` 7.5
waits on this.

## 1. One write at a time

- [x] 1.1 `AgentStatusWriter` takes its writes one at a time: a renewal,
  an activity and a streamed activity queue behind whatever write is under
  way. `enqueue()` chains every write; pinned by 4.4.
- [x] 1.2 A queued write builds its document when it runs, so a renewal
  queued behind an activity write never puts back the older activity.
  By construction — `writeNow()` builds it once its turn comes; no test
  tells this apart from building it when asked.
- [x] 1.3 The queue survives a failed write: the next one still runs.
  Pinned by 4.2's last write.

## 2. A refused replace

- [x] 2.1 A rename refused with `EPERM`, `EACCES` or `EBUSY` is retried a
  bounded number of times with a short, growing pause, the whole well
  under `AGENT_STATUS_RENEW_INTERVAL_MS`. `retryWhileInUse`: five tries,
  pauses of 25, 50, 75 and 100 ms. Pinned by 4.1.
- [x] 2.2 The record is not removed to make room for a refused rename.
  Remove-then-rename stays only for `EEXIST`, where retrying cannot help.
  `replaceRecord`; 4.2 asserts the record is never removed.
- [x] 2.3 A write that still cannot land is dropped: its temporary file is
  removed and the previous record stands. Pinned by 4.2.

## 3. Nothing reaches the run

- [x] 3.1 The heartbeat timer's write can never reject unhandled. The
  timer calls `writeQuietly()`; pinned by 4.3.
- [x] 3.2 `reportActivity` and `noteStreamedActivity` resolve when their
  write has landed or been dropped, and never reject. Both go through
  `writeQuietly()`; 4.2 drives `reportActivity`, and
  `noteStreamedActivity` takes the same path without a test of its own.
- [x] 3.3 `start()` still rejects when its first record cannot be written,
  so `startAgentStatusWriter` leaves the run unreported, as today. "still
  refuses to start when its first record cannot be written".
- [x] 3.4 `stop()` waits for a write under way before removing the record,
  and no write lands after it. Pinned by 4.5. Its removal is asked again
  while the name is in use too, and a removal that still fails is left to
  the staleness window rather than rejected.

## 4. Tests

In `packages/core/src/agent-status-writer-failures.test.ts`, over files
kept in memory. 2026-09-13: 6 passed, with the 24 of
`agent-status.test.ts`; core typechecks and lints.

- [x] 4.1 A rename refused twice with `EPERM` and then allowed: the record
  is written and nothing rejects — through a file-operations seam the
  writer takes as an option, defaulting to `node:fs/promises`. "asks
  again when a rename is refused as in use, and the record lands".
- [x] 4.2 A rename that is always refused: `reportActivity` resolves, the
  previous record is still readable, and no temporary file is left. "keeps
  the previous record when a rename is always refused, ...".
- [x] 4.3 A heartbeat whose write is always refused raises no unhandled
  rejection across several intervals, with fake timers; the suite fails
  on one. "raises no unhandled rejection from a heartbeat whose every
  write is refused" — three renewals, and a listener on
  `unhandledRejection`.
- [x] 4.4 A renewal falling due during a slow activity write: the file
  operations see two complete writes one after the other, never
  interleaved. "takes a renewal that falls due during a slow write after
  that write, never beside it". Its first run counted the temporary
  file's removal as a step and failed on the test's own arithmetic; the
  order it now checks is of writes and renames.
- [x] 4.5 `stop()` called while a write is under way leaves no record.
  "leaves no record when a clean stop comes while a write is under way" —
  it waits until the held write has begun, since a write that has not
  begun when the stop comes writes nothing and would prove nothing.
- [x] 4.6 The existing concurrent write-and-read test still passes. All 24
  of `agent-status.test.ts` passed.

## 5. Verification

- [x] 5.1 This change validates strictly. `check(validate-change)`
  2026-09-13, after the tasks were ticked: valid.
- [x] 5.2 `npm run verify` unpiped, after the last edit, with everything
  staged. Record the run and the per-package test counts. 2026-09-13,
  exit 0: typecheck and every lint passed; cli 132 tests (13 files),
  core 1209 (85), extension 327 (24), server 86 (4), webui 404 (43).
- [x] 5.3 A pending changeset exists. `check(changeset-present)`
  `.changeset/a-status-write-never-stops-a-run.md`, `@openspec-ui/core`
  patch; dependents follow through `updateInternalDependents`.
- [ ] 5.4 **Delegated to claude-cli**: on this Windows machine, start a
  real `openspec-ui-cli run` of a small fixture change in a second working
  directory, and read `openspec-ui-cli status` every second until the run
  ends. Evidence: the run's exit code and log, and the status output
  across the run. The unit tests refuse a rename on purpose; only a real
  run shows that a run survives whatever Windows actually does.
