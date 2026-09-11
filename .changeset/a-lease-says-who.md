---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": patch
---

A workspace lease says who took it, and can be asked about.

The lease records the git identity of the working directory that took it
— `user.email`, falling back to `user.name`. It is attribution, never
authentication: anybody can set that value to anything, so it is called
"git author" wherever it is shown and nothing is permitted or refused on
the strength of it. A lease taken where no identity is configured is
valid and records none, exactly like every lease written before this.

It is read once where a host starts up, never in the heartbeat — that
renews every five seconds, and the value cannot change during a run.

`openspec-ui-cli lease` answers who holds a workspace without trying to
start a run and reading the refusal, which was the only way to ask
before. It exits `0` held or free: the question was answered either way.

`openspec-ui-cli lease release` clears a lease only where it can
establish that the holder is gone — the heartbeat is already stale, or
the holder is on this machine and its process is not running, checked
with a signal that delivers nothing. There is deliberately no `--force`.
A holder that died already self-heals once its heartbeat goes stale; a
holder that is alive still has the workspace open, and taking its lease
would permit a second mutating run against files it is still holding,
which is what the lease exists to prevent. A stuck holder is stopped,
not robbed.
