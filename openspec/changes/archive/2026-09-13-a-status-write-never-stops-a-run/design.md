## Context

`AgentStatusWriter` (ADR 0028, `an-agent-says-what-it-is-doing`) owns one
file per run. Today:

- `start()` writes the first record, then `setInterval(() => void
  this.write(), AGENT_STATUS_RENEW_INTERVAL_MS)`.
- `reportActivity()` and `noteStreamedActivity()` call `write()` directly
  and await it.
- `write()` writes `<id>.json.<uuid>.tmp`, renames it onto `<id>.json`,
  and on `EEXIST` or `EPERM` removes `<id>.json` and renames again.
- `withAgentStatus` applies each event's write in its own promise chain
  and catches its failure. `startAgentStatus` catches a failed first
  write and lets the run go on unreported.

The evidence is the log of the second agent's run in
`what-the-others-are-doing` 7.5: the error came from `rename` inside
`write()` with `EPERM`. `EPERM` from the first rename is caught, and the
removal is `force`, so the rename that escaped was the second one. The
process then printed Node's uncaught-error banner and exited 1 — the
shape of an unhandled rejection, which only the timer's `void` can
produce.

## Decisions

**A queue inside the writer, not at its callers.** Each write is chained
onto the previous one. Callers already assume a call is one write; making
every caller serialise would repeat the rule in three hosts. The chain
never rejects: each link catches its own failure, so one failed write
cannot stop the ones behind it.

**Each queued write writes the state current when it runs.** The document
is built inside the link, not when the write was asked for. A renewal
queued behind an activity write therefore never puts back the older
activity.

**Retry the rename; stop removing the record.** A replace refused with
`EPERM`, `EACCES` or `EBUSY` is retried a handful of times with a short,
growing pause, the whole bounded well below the renewal interval. On
Windows these mean the name is in use for a moment — by the other write
before the queue, by a reader, by an indexer — and the moment passes.
Removing the record first did not help while the name was in use, and it
opened a window in which a live run had no record at all. Remove-then-
rename stays only for `EEXIST`, which means a filesystem that will not
replace a name at all, where retrying cannot help.

**A write that cannot land is dropped, quietly.** Its temporary file is
removed and the previous record stands. Nothing is reported: a reader
already sees `heartbeatAgeMs` grow, and a writer that can never write
becomes `gone` after the window — which is true of what can be known
about that run from outside.

**`start()` keeps rejecting.** A writer whose first record never landed
is not handed to the run, so the run goes unreported rather than
half-reported, as `startAgentStatus` does today. After retries, a first
write fails only when the directory is genuinely unwritable.

**`reportActivity()` and `noteStreamedActivity()` stop rejecting.** They
resolve when their write has landed or been dropped. `withAgentStatus`
keeps its own catch; it is no longer the only guard.

**`stop()` waits for the queue.** It marks the writer stopped, clears the
timer, waits for the write under way, then removes the record. A link that
runs after the mark writes nothing.

**A seam for the file operations.** The writer takes an optional set of
`mkdir`, `writeFile`, `rename` and `rm`, defaulting to
`node:fs/promises`, so a test can refuse a rename on demand instead of
hoping to provoke Windows into it.

## Risks

- A filesystem call that hangs holds the queue, and `withAgentStatus`
  waits for the queue when a run ends. That was already true of the
  wrapper's own chain; this change adds no new wait to a run in progress.
- Retries add up to a fraction of a second to a write in the worst case.
  No run waits for a renewal; an awaited activity write was already a
  filesystem round trip.
