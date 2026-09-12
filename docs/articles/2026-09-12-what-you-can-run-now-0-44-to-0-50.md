# What you can run now: OpenSpec Workbench 0.44 → 0.50

Six releases of the extension, and the shortest description of them is
that the tool stopped needing to be watched.

0.40 → 0.44 was about a run explaining itself: what it is about to do,
what it cannot do, why it stopped. This stretch is about what you do with
a run that can explain itself — start it from a terminal, start several
at once, hand one item to an agent, ask for it at four in the morning,
and know who is holding the workspace when two of you are on the same
machine.

Written against `core` 0.74.0, `server` 1.21.0, `webui` 1.39.0,
`openspec-ui-vscode` 0.50.3 and `@openspec-ui/cli` 0.8.0. Every section
names the change it came from, under `openspec/changes/archive/`, so
nothing here has to be taken on trust.

---

## A change runs from a terminal

```bash
openspec-ui-cli run my-change
```

That is the whole thing. The chain runs — propose, review, apply, verify,
archive — printing stages as they happen, or one JSON event per line with
`--format json`.

Three exit codes, and the distinction is the point: `0` the chain
completed, `1` the change did not (a stage failed, a declared check
failed, the run was cancelled), `2` the CLI declined to start or could
not. A CI job can tell "your change is broken" apart from "the tooling is
broken" without reading the output.

What it deliberately does not have is a flag that overrules the change.
There is no `--yes` that answers a confirmation the change asked for, and
no flag that starts a chain for a change configured to run one stage at a
time — a terminal run does exactly what that change's own
`harness.json` already permits, and says so when it refuses. It takes the
same workspace lease the two interactive hosts take, so a terminal run
and an editor cannot both be mutating the same directory.

*From `2026-09-11-a-change-runs-from-the-terminal/`.*

## Several changes at once, each in its own directory

One workspace permits one mutating run. That used to mean one change at a
time, full stop.

```bash
openspec-ui-cli worktree add my-change
openspec-ui-cli worktree list
openspec-ui-cli worktree remove my-change
```

Each change gets a git worktree of its own, branch named after the
change, cut from `main` by default — a sibling directory, not a
subdirectory, so nothing lands inside the repository it came from. Two
changes in two directories are two workspaces, and each takes its own
lease.

Whether two changes may sensibly run side by side is decided from what
they actually touch: the capabilities their spec deltas name, and the
files their branches have changed. Not from prose, and not from a
guess.

*From `2026-09-11-changes-run-side-by-side/`.*

## What can start now

```bash
openspec-ui-cli ready
```

Every active change, its state — running, blocked, ready — and for the
ready ones, which others each can be started alongside, and what any two
would collide over. A change that is ready but has nowhere of its own to
run is told so, with the one command that gives it a directory.

It exits `0` whether or not anything is ready. A repository whose changes
are all running, or all waiting on each other, is in a perfectly good
state; reporting that as a failure would make the command unusable in
anything that checks an exit code.

*From `2026-09-11-what-can-start-now/` and
`2026-09-11-an-empty-queue-is-not-a-failure/`.*

## One task, one agent

A `tasks.md` item can be marked as waiting on somebody:

```markdown
- [ ] 5.4 **Delegated to `claude-cli`**: with a real run holding a
  workspace, ask who holds it and try to clear it.
```

The standalone shell's "Waiting on somebody" block and the extension's
Human-Only Inbox list every such item across every change, with who each
one is waiting on. Where that is an agent this build carries, the row
offers a **Run** — **OpenSpec UI: Run This Delegated Item** in the
editor — and the agent runs against that one item.

Which agent runs which task is configuration, not a marker in prose:

```json
{ "taskAgents": { "5.4": { "agent": "claude-cli", "customAgent": "reviewer" } } }
```

An item waiting on a person is offered no button, because there is
nothing to press. That is the same rule everywhere in this product: a
control exists where it can do something.

*From `2026-09-11-a-delegated-item-runs-its-agent/` and
`2026-09-10-human-only-inbox-in-the-shell/`.*

## A run that starts without you

A run can be scheduled: pick the change, pick the path — a single stage
or the chain — pick the time, and close the laptop lid.

The half that matters is what happens when the time passes with nothing
open. The schedule is not a timer in a page that has to stay loaded: a
time that has already passed starts on the next opening rather than
being silently dropped, so a schedule set for the night does not depend
on somebody having left a browser tab running.

*From `2026-09-10-a-run-can-be-scheduled/` and
`2026-09-11-a-schedule-keeps-its-promise/`.*

## Checks before the verifier is spent

A change's own `tasks.md` can declare what must mechanically hold:

```markdown
- [ ] 6.1 `openspec change validate --strict my-change` `check(validate-change)`
- [ ] 6.2 The whole suite passes. `check(test)`
```

Six names, a closed set: `validate-change`, `typecheck`, `test`, `lint`,
`path-unchanged`, `changeset-present`. They run **before** the verifying
agent, and a failing one skips that agent entirely — the stage fails with
the failing check's own reason, and no agent run is spent reviewing work
a mechanical check already found broken.

A `tasks.md` that declares nothing runs `verify` exactly as before.

*From `2026-09-10-a-check-that-passes-checked-something/`.*

## A change can say what it needs, and what it is waiting for

Two things a change can now declare about itself.

**A step it needs that the standard sequence does not have** — inserted
at a stated position, from a registry, never as a free-form command. A
free-form step would be a hole in the allowlist and the cwd sandbox; a
named one is a step this product knows how to run.

**A blocker**: `blocked_by: another-change` in the change's
`.openspec.yaml`. A blocked change is reported as blocked rather than
started, and the relation resolves the moment the change it names is
archived. A cycle among blockers is a deadlock and is reported as one —
the repository's own test fails on a relation naming a change that does
not exist, so the graph cannot quietly stop describing the repository.

*From `2026-09-11-a-change-can-declare-a-step/` and
`2026-09-11-a-declared-blocker-blocks/`.*

## Who holds this workspace

Two people on one machine, or one person with two checkouts, used to see
"another host is running a mutating operation" and learn nothing about
whose run it was.

```bash
openspec-ui-cli lease
```

```
Held by terminal run on HPP-NTB63, pid 3992.
Last reported itself 1s ago.
Git author somebody@example.com.
```

The identity is the working directory's `user.email` — the same
self-declared label that signs every commit. It is **attribution, never
authentication**: anybody can set it to anything, so nothing is permitted
or refused on the strength of it, and the line says "git author" rather
than "user" for exactly that reason.

`openspec-ui-cli lease release` clears a lease only where its holder can
be shown to be gone: the heartbeat is already stale, or the holder is on
this machine and its process is not running. A live holder is refused,
and the refusal says that stopping that process is the remedy — taking
its lease would let a second mutating run start against files it still
has open, which is the whole point of the lease. A holder on another
machine cannot be checked from here, so it is refused rather than
guessed at.

*From `2026-09-12-a-lease-says-who/`.*

---

## Where the settings live

Nothing above is configured by a flag. Every one of them reads the
change's own `openspec/changes/<id>/harness.json`, or the workspace
default in `openspec/agent-harness.json`.

- [`HARNESS.md`](../../HARNESS.md) — every key, its accepted values, which
  ones a global file may not set, and which have no control in either UI
  and must be hand-edited.
- [`LIMITS.md`](../../LIMITS.md) — what actually caps a run, which is not
  always the setting you would expect.

Both are reference documents. If you are looking at this article because
you want one specific thing done, they are where the detail is.
