# Design

Builds on `an-agent-says-what-it-is-doing` and
`docs/adr/0028-agents-coordinate-beside-the-repository.md`. Names below
(`AgentStatusWriter`, `readAgentStatuses`, the `.agent-status`
directory) are that change's, and this change follows them if they move.

## Decision: nothing to harvest, rather than a reliable harvest

The alternative was for an agent to collect what is worth keeping from
its status file and only then remove it. That works on a clean end and
loses everything on a crash, and a crash is the case the status file
exists to make visible.

So the status record is kept incapable of holding anything worth
keeping. It is overwritten on every write and carries only the present:
activity, stage, change, working directory, when the activity last
changed, and a heartbeat. A run's history — `started`, its stage, its
usage, its outcome — goes to the audit log when each thing happens.

`agent-runner` already does this: it records `started` before invoking
an agent and records the outcome after. What this change adds is the
requirement, so the property survives a later change that would find it
convenient to keep a little history in the status file.

## Decision: sweeping is its own function; reading stays pure

`readAgentStatuses` is a pure function over the directory, and every
surface relies on it answering the same way. A read that deleted things
would make two surfaces reading at once race each other over which of
them removed a file, and a reader called in a test would change the
directory it was asked to describe.

`sweepAgentStatuses` is separate, and its result says what it removed.

## Decision: re-read immediately before removing

A record read as stale a moment ago may have been renewed since: a writer
that was slow, not dead. So each candidate is read again right before
removal and removed only if its heartbeat is still past the window.

That narrows the race; it does not close it. A writer can still rename a
fresh record into place between the second read and the removal. The
cost is bounded and self-healing: the writer writes again within one
renewal interval, five seconds, and its record reappears. A record that
disappears for five seconds is an acceptable price; a lock would be a
second lease, which ADR 0028 already declined.

## Decision: orphaned temporary files are swept by age

The writer's temporary `<id>.json.<uuid>.tmp` is removed in a `finally`,
so it outlives a write only when the process dies mid-write. The reader
never sees it. It is swept when its modification time is older than the
staleness window — the same window, because "a writer that has not
touched this for that long is gone" is the one rule this directory uses.

## Decision: a malformed record is never swept

A record that is not JSON, lacks required fields, or names an identity
other than its own file name is reported by the reader as malformed.
Rename makes a half-written record impossible, so a malformed one is
genuinely wrong or was written by something else. Either way it is a
finding, and removing it would remove the evidence. It stays until a
person removes it.

## Decision: swept where status is read, and on start

The sweep runs where the directory is already being read — the CLI
status command and the pipeline tab's poll — and once when a writer
starts. That is enough to keep the directory bounded without a timer,
a daemon, or anything running when nobody is looking.

## Non-Goals

Reporting from agent sessions this product did not start.

Collecting anything from a status record before removal.

Removing malformed records.

A lock around the directory.

## Risks / Trade-offs

A live but very slow writer whose heartbeat lapses past twenty seconds
loses its record, which reappears on its next write. Its run is
unaffected; only the display blinks.

Two sweeps at once may both try to remove one file. Removal tolerates a
file that is already gone, so the second is a no-op.
