# 0027: A Working Directory Is Disposable, and Nothing of Value Stays In It

Status: Accepted

Date: 2026-09-12

## Context

ADR-0022 gave a change its own working directory. The default put it
beside the repository — `<repo>.worktrees/<change>` — and that default
has now met a real disk. `C:\Prog` holds seventeen directories, of which
eleven are repositories; the rest are working directories, leftover
copies, and a second clone of one project. The owner's phrase was that a
folder which used to hold repositories became a zoo.

Only one of those entries comes from this tool's default. The others
have no `.git` at all and were made by something else. A new default
will not tidy them, which is worth saying plainly before choosing one.

Two things were also discovered while looking:

- A working directory's `.openspec-ui/` is gitignored, so `audit.jsonl`
  — the run history every recommendation, timeline and quality figure is
  built from — never leaves it by commit.
- `git worktree remove` without `--force` refuses uncommitted *tracked*
  work but does not see ignored files. Measured in a throwaway
  repository: the ignored log leaves the directory clean, removal exits
  `0`, and the log is gone. The tool destroys its own evidence at
  exactly the moment that evidence first becomes interesting.

So "where do these directories live" and "what has to leave one before
it goes" are one question. Choosing a location without answering the
second would be choosing where to lose things.

## Decision

**One root for every repository's working directories.**

They live at `<root>/<repository>/<change>`: one directory in the
person's workspace folder for every repository, rather than one beside
each. The root is configurable.

It stays **outside** the repository. `change-worktrees.ts` already
records why: a complete second copy inside is something every recursive
tool in the repository walks into.

**The root is a property of a machine, not of the repository.**

It is read from the environment and from a user-level file, never from
`openspec/config.yaml`. A repository's config travels to every checkout,
and one person's disk layout is not a fact about the project. A setting
in the wrong file is a setting that arrives where nobody wanted it.

**Not the system temporary directory.**

It was considered, and the reasoning for it is sound as far as it goes:
these directories are disposable, and once their artifacts have been
transferred the directory itself is worth nothing.

It is rejected because that sentence has an "once" in it. The system
temporary directory is swept — by Storage Sense, by disk cleanup, by
anything that deletes files older than a few days — and the sweeper
cannot know whether the transfer happened. Handing deletion to it means
the only mechanism that removes these directories is the one mechanism
that cannot check the precondition for removing them safely.

It would also bypass a refusal this project deliberately built.
`worktreeRemove` passes no `--force`, so a directory holding uncommitted
tracked work is refused. A filesystem sweep refuses nothing.

And on Windows it is long. A temporary path is some thirty characters
deeper than a short root, before a monorepo's nested `node_modules`
begins, against a limit of 260.

Disposable is right. Disposed of *by the tool, after the transfer* is
the part that has to stay true.

**Removal harvests what is not in git, and says what it discards.**

Before a working directory is removed, its run history is copied into
the repository's own. Entries already record their own `cwd` and
`changeDir`, so a combined log is unambiguous and de-duplicable by
`runId`; nothing has to be rewritten to merge.

Whatever is not harvested is **named** at the point of removal rather
than deleted quietly. A destroyed thing that was announced is a
decision; one that was not is a discovery, made later, by whoever needed
it.

**The log is the artifact; most of what one would list separately is
inside it.**

When asked what else should be transferred — timestamps, failures — the
answer for both is that they are already in `audit.jsonl`: it carries
the run's identity, agent, agent version, timings, usage, outcome and
summary. Timelines, costs, verify quality and recommendations are all
derived from it and from nothing else. Transferring it transfers them.

What is genuinely separate, and what becomes of it:

- **The run journal** (`workbench-runs.json`) — recovery state for runs
  in flight. Its value expires when they end. Named at removal, not
  transferred.
- **Checkpoints** — the before-and-after a rollback would use. Large,
  and their purpose ends when the change archives. Named, not
  transferred.
- **The lease** — ephemeral by construction. Not named; there is nothing
  to say about it.
- **Failure artifacts from the browser suite** — traces and videos,
  produced only when something failed, which is exactly when somebody
  wants them. Harvested when present.

**Commits are not at risk, and saying so bounds the problem.**

A working directory's branch and commits live in the shared object
store, not in the directory. Removing it loses neither. What can be lost
is exactly two things: uncommitted work, which removal already refuses,
and ignored files, which this ADR is about.

## Consequences

A person's workspace folder gains one directory for all repositories
instead of one per repository.

Existing working directories do not move by themselves. `git worktree
move` relocates them, offered as a command; directories the tool never
created are reported and left alone, because what is in them is not
known here.

Removal costs a copy of a log that is measured in tens of kilobytes.

A combined log contains entries from directories that no longer exist.
That is the point, and each entry says where it ran.

## Alternatives considered

**The system temporary directory.** Rejected above: deletion by
something that cannot know whether the transfer happened, a refusal
bypassed, and a long path on Windows.

**Keeping the current sibling default.** Rejected: it is one directory
per repository in a folder that holds many, which is the complaint.

**Writing every run's audit entries straight into the primary
checkout.** Rejected: it reintroduces the shared mutable file that
per-directory isolation removed, with concurrent appends from several
runs — on Windows without a guarantee of atomicity — and would need a
lock in the hot path to replace a copy at a rare moment.

**Refusing to remove a directory until its artifacts are transferred.**
Rejected as the primary mechanism: it makes tidying up a negotiation.
Harvesting first and then removing achieves the same end without one.

**Putting the root in `openspec/config.yaml`.** Rejected: it would send
one person's disk layout to every checkout of the project.
