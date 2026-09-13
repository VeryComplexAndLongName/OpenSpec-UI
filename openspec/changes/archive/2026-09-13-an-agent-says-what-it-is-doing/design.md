# Design

See `docs/adr/0028-agents-coordinate-beside-the-repository.md`. This
change implements the first half of it: the status a run writes, and
reading it. Signing and the stop request follow in the second.

## Decision: the agent writes, nobody queries

A run this host started already streams its events. A session started in
another working directory does not: we did not start it, nothing is
listening, and there is no endpoint to ask.

Inverting it costs nothing and works for both. The run writes a small
file; anybody reads the directory. It is the shape the lease already
has, and it needs no protocol, no service and no port.

## Decision: named by the run, never by the person

A person's identifier cannot name the file. One person routinely runs
two agents — that is the situation this repository is in today — and
both would write to one file. Nothing else in the design survives that.

Each run generates an identifier at startup and shares it with nobody:
the device `WorkspaceLeaseManager` already uses for `holderId`.

It is repeated inside the file. Nothing prevents another process from
writing a file it does not own — the filesystem permits it between
processes of one user — so this is an invariant that is **checked**
rather than enforced, and a mismatch is reported instead of passing
unnoticed.

## Decision: one staleness rule, not two

A status carries a heartbeat, and one older than the staleness window
means its writer is gone.

That is the lease's existing rule and the same window. A second
definition of "gone" would be free to disagree with the first, and the
disagreement would surface as two surfaces describing one run
differently.

## Decision: liveness is answered; progress is what is added

| question | answered today by |
|---|---|
| is the process alive | `isProcessRunning(pid)` |
| has the holder gone | the lease heartbeat |
| is it past its limit | the run's time limit |
| **when did it last do anything** | **nothing** |

Only the last row is this change. A hung run keeps its heartbeat and
keeps its process; what stops is what it says it is doing.

## Decision: report the interval, never the verdict

A long agent turn produces nothing for minutes and is indistinguishable
from a hang while it is happening. So the reading is "last said
something 14 minutes ago", and there is no "stuck" field.

Inventing the verdict would be stating a fact the data does not carry —
the mistake this project has already corrected twice in wording, over
"user" and over "owner".

## Decision: written where no removal takes it

The directory sits beside the working directories of a repository rather
than inside one. A status inside a working directory would be destroyed
with it, which is how `audit.jsonl` came to be destroyed, and a run's
status is most interesting exactly when somebody is deciding whether to
remove that directory.

## Non-Goals

Asking a run to stop. That is the second change, and needs the signed
channel: a stop is acted on, and a message that is acted on is worth
forging.

Pausing. A paused run holds its lease and its working directory while
doing nothing, which is what a hung one looks like.

A verdict about whether an agent is healthy.

Querying an agent for anything. There is nothing to query.

## Risks / Trade-offs

A run that dies without writing leaves its last status behind. The
heartbeat is what makes that harmless, and it is the same mechanism that
already makes an abandoned lease harmless.

A status is a moment. Between two readings a run can start, say
something and finish; a reader is told when it last looked, as the
pipeline tab already is.

The activity line is written by the run about itself. It is a claim, and
a run that lies or is wrong about its own state will say so convincingly
— which is why the heartbeat and the interval, which it cannot fake by
staying silent, carry the diagnosis rather than the text.

Writing every few seconds is one small file per run. A directory of them
is read in full on each poll; at the scale this project has, that is
file reads and no subprocess.
