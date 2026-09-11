# Design

## Decision: attribution, and the word is load-bearing

The lease gains the git identity of the working directory that took it —
`user.email`, falling back to `user.name`. It is the same value that
signs every commit in the repository, so it is already the name people
recognise each other by here.

Anybody can set it to anything. That is stated in the type, in the
message, and in this file, because the failure mode of recording it is
not that it is wrong: it is that a later reader treats a self-declared
label as an audit trail. The message says "git author", never "user",
and nothing gates on it.

## Decision: read once, not per heartbeat

`acquireOrRenew` runs every five seconds while a mutating run is
active. Reading `git config user.email` there would spawn a process
twelve times a minute for a value that cannot change during a run.

So the identity is gathered once by whoever constructs the manager —
three places, one call each at activation — and passed in. A manager
given none records none, which is what every lease written before this
change already looks like.

## Decision: a stuck lease is mostly not a thing, and the remedy is not force

The tempting design is `lease release --force`. It is wrong, and working
out why changed this change's shape.

A holder that **died** stops renewing, and the next acquirer reclaims
the lease automatically once the heartbeat is older than the staleness
window. That case already heals; nothing is needed.

A holder that is **alive and still renewing** has the workspace open. It
may be stuck — an agent waiting forever on something — but taking its
lease would let a second mutating run start against files the first one
still has open, which is the exact scenario the lease exists to prevent.
The remedy there is to stop that process, not to steal from it.

So `release` clears a lease only where it can establish the holder is
gone:

- the heartbeat is already stale — the holder is gone by the definition
  the lease has always used; or
- the holder is on **this** hostname and its pid is not running.

`process.kill(pid, 0)` answers the second without signalling anything:
`ESRCH` means no such process, `EPERM` means it exists and belongs to
somebody else. A holder on another hostname cannot be checked from here
at all, and the refusal says that rather than guessing.

## Decision: asking is its own command, not a side effect of being refused

Today the only way to learn who holds a workspace is to try to start a
run and read the refusal. That is a strange way to ask a question, and
it means the answer is only available at the moment you are being told
no.

`openspec-ui-cli lease` prints the holder — kind, hostname, pid, how
long since its heartbeat, and the git author where one was recorded —
or says the workspace is free.

## Decision: exit codes say what was found, not whether the tool worked

`lease` exits `0` whether or not the workspace is held: it answered the
question either way, and a script checking "is it free" should read the
output rather than infer from a failure code the way `validate` does.

`lease release` exits `0` when it cleared one, `1` when it refused
because the holder is alive or unverifiable, and `2` when it could not
look at all.

## Non-Goals

Authentication. Per-person permissions. Identity in the audit log, which
is a larger change through a runner that has no notion of a workspace.
Clearing a lease held by a live process.

## Risks / Trade-offs

A pid on this hostname can be reused. A holder that died and whose pid
was taken by an unrelated process reads as alive, and `release` refuses
where it could safely have cleared. That is the direction to fail in:
the staleness window still clears it twenty seconds later, so the cost
is a wait, not a stuck workspace.

Recording an email address in a file inside the repository's working
directory — `.openspec-ui/` is gitignored, so it does not leave the
machine, but it is written where a person might not expect it. Named
here so the choice is visible.
