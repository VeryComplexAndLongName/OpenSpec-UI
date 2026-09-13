# An agent says what it is doing

## Why

Two agents work on this repository at once. One of them can hang, and
nothing tells a person that it has.

Everything observable today says the wrong thing about that case. The
lease's heartbeat keeps arriving, because the process is alive — a hung
agent renews its lease exactly as a working one does. The process
answers `process.kill(pid, 0)`, because it exists. `a-lease-says-who`
already reached this conclusion from the other side: a holder that is
alive but stuck must be stopped rather than robbed, and said nothing
about how anyone would know.

So the missing signal is not liveness. It is **progress**: what the run
says it is doing, and how long it has been saying it.

There is no way to ask an agent for it, either. A run this host started
streams events, but a session started in another working directory is
not ours — it has no endpoint and nothing is listening. The answer is to
invert the question: the agent **writes**, and anybody reads. That is
what the lease already does, and it needs no protocol, no service and no
network.

A caution that shapes the whole change: silence does not prove a hang. A
long agent turn produces nothing for minutes and looks identical. The
report therefore says how long it has been since the run last said
something, and never returns a verdict.

## What Changes

- Every run writes a **status file of its own**, in a directory shared
  by all the working directories of a repository and outside every one
  of them, so no directory's removal takes it.
- The file is named by the run's **own identifier**, never by a person:
  one person routinely has two agents, and a person-named file would
  have them writing to one file.
- It carries what the run is doing now, what stage it is in, which
  change and working directory, and a heartbeat.
- A status older than the staleness window means the writer is gone —
  the rule the lease already uses, not a second one.
- Written to a temporary name and renamed into place, so half a file is
  never read as a whole one.
- The identifier is repeated **inside** the file, so a mismatch with the
  name is a finding rather than silence.
- Reading them is a pure function: the same answer for the shell, the
  terminal, and anything else that asks.

## Impact

- `packages/core` — writing a status beside the lease, and reading every
  status of a repository.
- `packages/cli` — showing them, so the question is answerable without a
  browser.
- No new dependency, no service, no network, and no change to how a run
  is started or cancelled.

This is the first of two changes from
`docs/adr/0028-agents-coordinate-beside-the-repository.md`. The second
adds the signed channel for asking a run to stop. This one stands on its
own: it is what makes a hung agent visible.
