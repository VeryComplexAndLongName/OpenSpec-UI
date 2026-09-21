## Context

`.agent-status` holds one signed file per run, written by
`AgentStatusWriter` through `withAgentStatus`, renewed every five seconds
and read by the Pipeline, the Changes views and `readAgentStatuses`. Its
records carry an instance id, a working directory, an activity, a change
name, a heartbeat and a signature; `gone` is derived from the heartbeat's
age against a staleness window shared with the workspace lease.

`.agent-roster` says whose key is whose. `.agent-messages` carries the
signed channel. All three sit beside the repository, on this machine, by
ADR 0028.

Nothing in that machinery is specific to a chain. What ties it to runs is
only the call site.

## Goals / Non-Goals

**Goals:**

- Two agents on one machine can see each other, and the owner can see both.
- A resource that is not a working directory can be held.
- Nothing new to learn for the surfaces that already read these records.

**Non-Goals:**

- Stopping an agent that ignores what it read.
- Any coordination that leaves this machine.

## Decisions

### A session writes the record a run writes

Rather than a second kind of record beside the first. The Pipeline, the
Changes tree, `readAgentStatuses` and the leases all read one shape today;
a second shape would mean teaching each of them, and a reader that knew
only one would show half the truth.

What differs is only what the fields say: no run id, an activity in the
present tense, and the change the session is working on where it has one.

**Rejected: a new directory for sessions.** Two directories to read, two
staleness windows to keep in step, and the first reader to forget the
second would report an empty machine.

### A claim is a record, not a lock

`.agent-claims`, beside the other three, one file per claimed resource,
holding the claimant's key id, the resource's name, when it was taken and
a heartbeat. Taking it is a write through a temporary name and a rename,
which is atomic on one filesystem: the loser of a race sees the winner's
file.

It expires by heartbeat, like every other record here, so a claimant that
dies does not hold a resource for ever.

**Rejected: an operating-system lock.** It dies with the process, which
sounds better until a claim must survive a person reading it: a lock says
nothing about who holds it, and this has to say who, since the answer is
what the other agent needs.

### Waiting is bounded and spoken

An agent that finds a resource held waits, saying whom it waits for and
for how long it will wait. Silence for two minutes is indistinguishable
from a hang, and the product's own rule elsewhere is that a reading says
what it is doing.

When the wait runs out it reports and stops, rather than proceeding: the
whole point is that two browser suites at once produce failures that look
like defects.

## Risks / Trade-offs

- **A claim is advisory.** An agent that does not ask holds nothing back.
  Named in the proposal as out of scope, and the record still says who
  was there when the collision is investigated.
- **Another heartbeat.** One more small file rewritten every few seconds
  while a resource is held, in a directory already written at that rate.
- **A session that forgets to end.** The heartbeat expires it, exactly as
  a run's record expires.
