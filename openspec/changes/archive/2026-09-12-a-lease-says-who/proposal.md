# A lease says who

## Why

An outside review of how this tool behaves for several people at once,
relayed on 2026-09-11, made two points about the workspace lease. Both
are correct, and one of them has a different remedy than it looks.

**It does not say who.** The lease records a host kind, a hostname and a
pid. Two people sharing a machine, or one person with two checkouts, see
"terminal run on HPP-NTB63, pid 4242" and learn nothing about whose run
it is. The audit log is worse: `AuditEntry` carries `runId`, `agent`,
`cwd`, `changeDir` and `usage`, and nothing at all about who caused it.

There is a signal already in every repository and not being used: the
git identity of the working directory, the same `user.email` that signs
every commit. It is **attribution and not authentication** — anybody can
set it to anything — and recorded as such it is exactly what a person
needs in order to know whose run is holding the workspace.

**There is no way to clear a stuck lease.** True, and the obvious
remedy is wrong. Where a holder has died, its heartbeat stops and the
next acquirer reclaims the lease automatically — that case already
heals. The case that does not heal is a holder that is alive and still
renewing while doing nothing useful, and taking the lease from it would
let a second mutating run start while the first still has the workspace
open. That is what the lease exists to prevent.

So what is missing is not a `--force`. It is the ability to ask who
holds the workspace without attempting a run, and a release that
establishes the holder is gone before clearing anything.

## Capabilities

### New

- A lease records the git identity of the working directory that took
  it, so a person can tell whose run holds the workspace.
- The holder of a workspace can be asked about directly, rather than
  discovered by trying to start a run and being refused.
- A lease can be cleared where the holder can be shown to be gone, and
  refused where it cannot.

### Modified

- A refusal naming the holder names the git identity too, where the
  holder recorded one.

## Out of scope

Authentication, access control, or per-person permissions. Anybody can
set `user.email` to anything, and a system that treated it as proof
would be worse than one that records nothing — it would look like an
audit trail while being a self-declared label. This records who says
they are running it, and says so in those words.

Identity in the audit log. Worth doing and a larger question: audit
entries are written per run by an agent runner that has no notion of a
workspace, and threading it there is its own change.

Clearing a lease whose holder is alive. That is what stopping the
process is for. A command that did it would defeat the isolation the
lease provides, at the moment somebody is most tempted to use it.
