# Design

See `docs/adr/0027-a-working-directory-is-disposable.md` for the
decisions: one root outside the repository, configured per machine and
not per repository, not the system temporary directory, and removal that
harvests before it deletes and names what it does not take.

## Decision: the root, and where its setting lives

`<root>/<repository>/<change>`. The repository segment is what lets one
root serve every project without two changes of the same name in
different repositories colliding on a path.

The root is read, in order: an environment variable, then a user-level
file, then a default. The default keeps the parent of the repository —
`<parent>/.worktrees` — so a person who sets nothing gets one hidden
directory where they previously got one per repository, at a path no
longer than today's.

It is deliberately not read from `openspec/config.yaml`. That file
travels to every checkout, and a person's disk layout is not a property
of the project; a setting placed there arrives on machines whose owner
never chose it.

## Decision: why not the temporary directory

The proposal was that these directories are temporary, so the system's
temporary directory is where they belong, and once their artifacts have
been transferred the directory itself is worth nothing.

The last clause is the problem, because of its "once". The system
temporary directory is swept by Storage Sense, by disk cleanup, by
anything that removes files past an age — and none of those can know
whether the transfer happened. Deletion would be performed by the one
mechanism unable to check the precondition for deleting safely.

It also bypasses a refusal built on purpose. `worktreeRemove` passes no
`--force`, so a directory holding uncommitted tracked work is refused; a
sweep refuses nothing.

And it is long. `%TEMP%` is some thirty characters deeper than a short
root before a monorepo's nested `node_modules` starts, against 260.

Disposable is right. Disposed of by the tool, after the transfer, is
what has to stay true.

## Decision: harvest, then remove

Removal copies the directory's `audit.jsonl` into the repository's own
before deleting anything.

Merging needs no rewriting: an entry already records its `cwd` and
`changeDir`, so a combined log says where each run happened, and `runId`
makes the merge idempotent — harvesting twice adds nothing the second
time.

Writes are not changed. Every run keeps writing to its own directory,
which is what keeps two runs off one file; the alternative — every run
appending to the primary checkout's log — reintroduces the shared
mutable file that per-directory isolation removed, and would need a lock
in the hot path to replace a copy at a rare moment.

## Decision: the log is the artifact

Asked what else should travel — timestamps, failures — the answer for
both is that they are already inside `audit.jsonl`. It carries each
run's identity, agent, agent version, timings, usage, outcome and
summary; `runTimestampsByChange`, `buildWorkspaceRunStats`,
`buildVerifyQuality` and the recommendations are all derived from it and
from nothing else.

What is genuinely separate, and what becomes of it:

- **`workbench-runs.json`** — recovery state for runs in flight, whose
  value expires when they end. Named at removal, not taken.
- **`checkpoints/`** — the before-and-after a rollback would use. Large,
  and its purpose ends when the change archives. Named, not taken.
- **`workspace.lease.json`** — ephemeral by construction. Not named;
  there is nothing to say.
- **Browser-suite failure artifacts** — traces and videos, produced only
  when something failed, which is when somebody wants them. Taken when
  present.

## Decision: what loss even means here

A working directory's branch and commits live in the shared object
store, not in the directory. Removing it loses neither.

Exactly two things can be lost: uncommitted work, which removal already
refuses, and ignored files, which this change is about. Saying so bounds
the problem and stops it growing into a general backup feature.

## Non-Goals

Tidying directories this tool did not create. Three entries in `C:\Prog`
have no `.git` at all; what is in them is not known here, and deleting
or moving them would be acting on a guess.

Changing how a run writes its log.

Backing up a working directory. The two recoverable things are named
above; everything else in one is either in git or reproducible.

Forbidding a location. A person who wants their directories somewhere
unusual sets the root and gets it.

## Risks / Trade-offs

A combined log holds entries from directories that no longer exist. That
is the intent, and every entry says where it ran — but a reader who
assumes a path still exists will be wrong.

Harvesting on removal does nothing for a directory deleted by hand, or
by a sweep, or by `git worktree remove` run directly. This makes the
tool's own path safe; it cannot make every path safe.

The default root changes where new directories appear. Someone with
scripts pointing at `<repo>.worktrees/<change>` will find the next one
elsewhere, which is why existing directories are reported rather than
moved out from under them.

Two repositories with the same directory name share a root segment.
Rare, and the failure is visible immediately rather than silent.
