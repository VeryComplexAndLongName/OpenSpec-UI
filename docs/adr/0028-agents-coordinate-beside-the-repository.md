# 0028: Agents Coordinate Beside the Repository, Not Inside It

Status: Accepted

Date: 2026-09-12

## Context

Several agents now work on one repository at once. ADR-0026 made the
others visible: their working directories are surveyed, read-only, and
never acted on. That answers "what exists". It does not answer the
questions that arose the moment two agents were actually running:

- One of them hangs. How does a person tell a long agent turn from a
  dead one?
- A person wants a run stopped. Today every run finishes on its own
  terms, and the only remedy is killing a process by hand.
- When a person does act, how does anyone else learn that it was
  settled?

The repository is the wrong place for any of this. Coordination traffic
committed into it would leave artefacts of a conversation in the record
of the work, and operational facts — who is alive, at what stage, asked
to stop — have no business in a project's history.

They do not need to be there. `.openspec-ui/` is already gitignored and
already carries the workspace lease, which is inter-process coordination
that has never appeared in a commit. What is missing is not a new idea;
it is a place shared by every working directory rather than one per
directory, and a little more in it than a lease.

The observation that shaped the rest: **a stop must be a request, not an
order.** An agent asked to stop finishes to a point that leaves the work
sound and then stops. Nothing else can be done safely across a boundary
this system does not control — and once it is a request, most of what a
command channel would have needed falls away.

## Decision

**The channel is a directory beside the working directories, not in the
repository.**

It sits at ADR-0027's root, one level above the working directories of a
repository: shared by all of them, outside every one of them, so no
directory's removal takes it. Nothing in it is ever committed.

**One writer per fact.**

Every participant writes only its own files and never another's. Status
is a file per agent instance; a message is a file of its own. Readers
merge by listing the directory.

No lock is needed and none is used. A lock has a holder that can die,
which needs a timeout, which needs a rule about who may break it — and
that is a lease, which this project already has one of. A second, weaker
one would be a mistake made twice.

**A status file is named by the instance's own identifier, never by a
person.**

A person's identifier cannot name the file: one person routinely runs
two agents, which would then write to one file and the whole structure
would collapse in the first hour. Each instance generates an identifier
at startup and never shares it — the same device `WorkspaceLeaseManager`
already uses for `holderId`.

The identifier is repeated inside the file, so a mismatch with the name
is detectable. Files are written to a temporary name and renamed into
place, so half a file is never read as a whole one. A status carries a
heartbeat, and one older than the staleness window means the writer is
gone — the rule the lease already uses, not a second one.

Nothing prevents a process from writing another's file; the filesystem
permits it. This is an invariant that is **checked**, not enforced.

**A stop is a recommendation.**

It is addressed to an instance by its identifier. The receiver decides:
it finishes to a point where the work is sound, says in its status that
it was asked and by whom, and stops. It never stops silently — a person
watching must be able to see that the stop was asked for rather than
inferred.

A person may ask any agent to stop, including somebody else's. Asking is
not authority.

**Pause is deliberately not offered.**

A paused agent holds its lease and its working directory while doing
nothing, which is indistinguishable from the hung agent this whole
design exists to diagnose. If pausing released the lease, resuming could
find it taken, so "continue" would not be a promise. Stop cleanly and
start again: the work's state is in `tasks.md`, and a new run picks it
up.

**Signatures, from the start.**

Not because the boundary exists today — one machine, one operating
system user, the directory's own permissions doing the real work — but
because defaults stick. Shipping unsigned means everybody runs unsigned,
and switching verification on afterwards breaks working setups, so
nobody switches it on. Security added after the fact is security nobody
enables.

**A key belongs to a person, on a machine.**

Not to an agent: a key born with a run would mean confirming enrolment
at every run. Not to a working directory: two people can share one, and
then one key crosses a trust boundary.

A person's agents work on that person's behalf and sign with that
person's key. A person has one key per machine — a private key must not
travel between machines, and losing a laptop should revoke one key
rather than an identity. The roster maps each key to the person it
belongs to.

This makes "is this mine?" **provable**, where `git config user.email`
only ever made it claimed. The two layers stay separate and are both
shown: the git author is what a message says about itself, and the
signature is what has been established.

**Ed25519 from the runtime, not from a binary and not from a
dependency.**

Node's `crypto` signs and verifies Ed25519 with no package and no
external program. Measured here: 13 220 signatures and 5 557
verifications a second, a 64-byte signature, keys that survive a PEM
round trip, private keys that can be passphrase-protected.

`ssh-keygen -Y sign` was the alternative and is present on this machine
(OpenSSH 9.5p1), but OpenSSH is an optional Windows component and `-Y
sign` needs 8.0 or newer, so a team's ability to coordinate would depend
on a checkbox in a list of Windows features. One invocation also costs
39 ms against microseconds in process.

Reusing a person's existing SSH key was rejected for a stronger reason
than availability: an unattended agent needs the private key without a
human, and a key that also opens `git push` cannot be revoked without
taking the person's repository access with it. A purpose-made key is
revoked on its own.

The roster is this project's own file. The `allowed_signers` format is
not reused: without ssh in the picture it would promise a compatibility
that does not exist.

**Verification is three-valued, and what it proves is stated exactly.**

**Verified**, **unverified**, and **does not check out** are three
different states, and the third is not a quieter form of the second. A
signature that fails is either tampering or a misconfiguration, and both
are findings.

A signature proves the person and the machine. It does **not** prove
which agent instance — all of a person's agents on a machine share the
key. So the instance stays a claim, and a surface that says "signed by
agent X" when the key belongs to a person would be saying more than it
knows. It says what it has: signed by a person, verified; instance,
claimed.

**Freshness is part of the envelope.**

A signature does not stop a replay, and a replay is exactly the attack
this channel invites: a genuine "please stop", kept and delivered again
tomorrow, stops an agent again. Every message carries a time and an
identifier of its own, and a receiver refuses a stale or already-seen
one.

**The bytes are what is signed.**

A signature covers the file's exact bytes, and a message is parsed only
after it verifies. Signing a re-serialised object invites the case where
the signature covers something other than what is displayed.

**Enrolment is one confirmation, and dormancy is reported.**

An unregistered key's messages are shown as unverified rather than
dropped, and its enrolment request appears where things that wait on a
person already appear. The request carries what a person needs to decide
at a glance — label, path, machine, git author, time. They confirm that
they started it; they are not asked to compare fingerprints.

A key whose owner has not been seen for a long time is reported as
dormant, never removed silently. The holder retires its own key on a
clean exit; staleness covers the crash, because a crashed agent retires
nothing. That pairing is how the lease already works.

A stale entry is a key nobody holds, so it is untidiness rather than
exposure, and is treated as such.

**Analysis produces a report; the operator decides.**

A shared list of blocked participants that any participant may write is
an escalation route, not a defence: whoever wants to disrupt the others
blocks them first. So frequency and origin are counted and shown, and
the binding decision is a person's — the same division this project
already uses for collisions between changes, which are reported and
never enforced.

An agent may throttle for itself and say so, which is recoverable. It
does not blocklist, which is not. And the report names a pattern —
"forty requests in a minute, from one key, to every directory" — never a
motive; the data does not contain intent.

Counting is a pure function over the message directory, like every other
derived figure here. No service holds it.

**Only verified messages count toward a participant's record.**

Otherwise the defence becomes a way to frame somebody: forge traffic
that claims to come from an honest participant and have them reported.
Unverified traffic is counted as belonging to nobody.

**The console does not offer what a person should not do by accident;
the protocol forbids nothing.**

Stopping somebody else's agent is not offered in the interface, and the
card says whose it is, so the absence explains itself. Anyone determined
can still ask over the command line and be named for it. Accidents are
prevented, deliberate acts stay possible and attributable.

Real enforcement is the operating system's: a process can only be killed
by someone it permits. That is the right place for it, because the
operating system knows who a person is and this tool does not.

## Consequences

A person confirms one enrolment per machine, and nothing again.

A hung agent becomes diagnosable: its heartbeat continues while what it
says it is doing does not change. The report says how long, and does not
say "stuck" — a long turn looks the same, and the judgement is a
person's.

The lease keeps its meaning. It says who holds a workspace; the status
says what they are doing with it. Neither answers for the other.

All of a person's agents speak with that person's full weight. There is
no way to grant one the right to report and withhold from it the right
to ask for a stop.

This is implemented in two changes, in this order: agents saying what
they are doing, and then the signed channel for asking one to stop. The
first stands on its own — it is what makes a hung agent visible.

## Alternatives considered

**An HTTP, WebSocket or TCP control channel between agents.** Rejected:
it requires something listening on every machine, with authentication
and authorisation this project deliberately does not have, to deliver a
message that is advisory anyway.

**Coordinating through the repository.** Rejected: it leaves the
artefacts of an operational conversation in the record of the work.

**A lock file over one shared message file.** Rejected: a file per
sender removes the contention by construction, and a lock would need a
staleness rule, which is a second lease.

**A key per agent instance.** Rejected: enrolment at every run, to
distinguish participants that a filename already distinguishes, against
a forgery the filesystem already permits between processes of one user.

**A key per working directory.** Rejected once two people can share a
directory: the key would cross a trust boundary.

**An npm package for signing.** Rejected: the runtime already does
Ed25519, and a dependency for it is supply-chain surface bought for
nothing.

**An automatic blocklist.** Rejected: writable by participants it makes
the defence into the attack, and writable only by an operator it is no
longer automatic. A false positive would also fire during exactly the
incident it was meant to help with — an operator legitimately stopping
everything looks like a flood.

**Enforcing ownership.** Rejected as impossible rather than unwanted:
before this ADR the only ownership signal was a self-declared git
identity. With the roster it becomes provable, but the enforcement of
who may end a process remains the operating system's.

## Revision triggers

Written down so the reasoning is not re-derived later:

- **The channel's directory becomes reachable by somebody untrusted** —
  a network share, a synchronised folder. The assumption that whoever
  can write is already trusted stops holding, and the permissions of
  that share become the thing to examine.
- **One working directory is shared by two people.** Already allowed by
  a key per person; it is the directory-keyed design that would have
  broken, and it is recorded here so nobody reintroduces it.
- **Agents need different rights from each other.** Then a key per
  person is not enough, and the certificate chain rejected above becomes
  the thing to weigh again.
