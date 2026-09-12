# A stale status is swept

## Why

`an-agent-says-what-it-is-doing` gives every run a status file of its
own, beside the repository's working directories. A run that ends
cleanly removes its file. A run that crashes removes nothing, and the
reader marks its file `gone` — and leaves it there.

So every crash leaves a file behind for good. With several agents
working, those files pile up, and the reader walks every one of them on
every poll to report runs that ended hours ago.

The owner's instinct was that agents should clean up after themselves,
after first collecting anything useful such as statistics. The first
half is right and already happens on a clean end. The second half is
where it goes wrong: **collecting at the end fails in exactly the case
this is for.** A crashed agent collects nothing. Anything it kept only in
its status file until a final harvest would go with it.

The answer is to make the harvest unnecessary rather than make it
reliable:

- A status record carries only the present — what the run is doing now
  and a heartbeat. It is overwritten, never appended, and holds no
  history.
- What a run did — started, which stage, what it cost, how it ended — is
  written to the audit log **as it happens**. `agent-runner` already
  records `started` before a run and its outcome after, so for runs this
  product starts, that is true today. This change pins it as a
  requirement, so nobody later turns the status file into a second
  history that then needs harvesting.

With nothing in a stale record worth keeping, removing it loses nothing,
and anybody may remove it.

One more leftover turned up while reading the writer. It writes a
temporary `<id>.json.<uuid>.tmp` and renames it into place. A process
that dies between the write and the rename leaves the temporary file
behind, and the reader never sees it, because it reads `.json` files
only. Nothing removes those either.

## What Changes

- A **sweep**, separate from reading: removes records whose heartbeat is
  past the lease's staleness window, and temporary files left by a
  write that never finished. Reading stays a pure function.
- A record is removed only after it is **re-read and found still stale**
  at the moment of removal, never on the strength of an earlier read.
- A **malformed** record is reported and never swept. A file whose
  identity does not match its name is evidence of something, and a
  sweep would destroy it.
- The sweep runs where status is already read — the CLI command and the
  pipeline tab — and when a writer starts. No timer of its own.
- A **requirement** that a status record holds no history, and that a
  run's history reaches the audit log as it happens.

## Impact

- `packages/core` — `agent-status.ts` gains the sweep; the writer calls
  it on start.
- `packages/cli`, `packages/webui` host code — the places that read
  status also sweep.
- No change to the status record's shape, the directory, or the audit
  log's format.

## Out of scope

Agent sessions this product did not start — a Claude Code session
editing files, for instance — write nothing to the audit log at all. Its
last entry in this repository is from 2026-09-08, while a great deal of
work has happened since. Whether and how such sessions should report is
a real question, and a separate one; this change does not answer it.
