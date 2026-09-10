# Design

## Decision: a schedule is a local intent, not project configuration

It lives in `.openspec-ui/scheduled-runs.json`, beside the audit log and
gitignored like it. `harness.json` says how a change runs; it is
committed, shared, and true until someone edits it. "Start this one at
six" is none of those — it is one person's intent on one machine, and it
stops being true the moment it fires.

## Decision: due is computed, never stored

An entry carries when it should start. Whether it is due is a comparison
against the clock, made where it is read. Storing a `due` flag would be a
second source of truth that is wrong between the moment it becomes true
and the moment something updates it.

## Decision: lateness is reported, not hidden

A run whose time passed while nothing was open starts at the next open
and says how late it is. Starting silently would make a schedule that
half worked indistinguishable from one that worked, which is the shape
this project keeps removing.

## Decision: one at a time, oldest first

Several entries can come due together, and the workspace lease already
refuses a second mutating run. The oldest starts, the rest stay due and
are reported as waiting — rather than failing against the lease and
looking like an error.

## Decision: an entry for a change that is gone is dropped and said so

A change that is neither active nor archived was deleted. Its schedule
cannot run, and keeping it would leave a permanent "waiting" that never
resolves. Same rule the run figures already apply to a deleted change's
runs.

## Decision: the same firing logic, called by each host

`dueRuns` and the file reader live in `core`. Each host asks on start and
on a tick; the standalone shell already polls, and the extension already
has an activation path. Neither reimplements when a schedule is due.

## Rejected: firing without showing anything

The run dialog exists because a surface that acts on a configuration and
shows nothing of what it read leaves a person unable to tell a correct
decision from a broken one. A scheduled run is that with a delay, so it
opens the same dialog, showing that it was scheduled and when.
