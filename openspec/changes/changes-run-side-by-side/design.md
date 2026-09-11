# Design

## Decision: a worktree is the isolation ADR 0010 was waiting for

ADR 0010 permits one mutating run per workspace "until mutations have
independent filesystem isolation". A git worktree provides exactly that:
a second working directory for one repository, on its own branch, with
its own files and its own `.openspec-ui/`.

So the lease is not relaxed, weakened, or made re-entrant. It stays
exactly as it is, and becomes what it always described — a guard on one
working directory rather than a queue for the repository. Two chains in
two worktrees take two different leases and never meet.

That is the whole mechanism. It is worth saying plainly because the
tempting alternative — making the harness concurrency-aware — would touch
the chain runner, the scheduler, the journal and the audit log, and every
one of those would then have a concurrent path that is exercised only
when two people happen to run two changes at once.

## Decision: the branch is named after the change, and so is the directory

`git worktree add -b <change> <path> <base>`, where `<change>` is the
change's own name. A change is already the unit this product tracks,
review, archive, and name things after; a branch called something else
would be a second name for the same work, and the two would drift.

The directory defaults to a sibling of the repository —
`<parent>/<repo>.worktrees/<change>` — rather than a path inside it. A
git worktree nested inside its own main working tree works, but it puts a
complete second copy of the repository under a directory that every
recursive tool in the repository will walk. `--path` overrides it for
anybody who wants otherwise.

## Decision: the change must already be committed

`git worktree add` checks out a commit. A change that exists only as
uncommitted files in the main working tree is not in that commit, so the
worktree would be created without the change it was created for —
technically successful and completely useless.

This is refused, naming the change and saying to commit it first. The
base commit is the branch the worktree is cut from (`main` by default),
and the check is that the change's directory exists in that commit rather
than that the working tree is clean: an unrelated dirty file is not this
command's business.

## Decision: spending is summed across the repository's working directories

This is the one thing splitting the workspace genuinely breaks.

`FileAuditLog` writes `<root>/.openspec-ui/audit.jsonl`, and the chain's
budget check reads it back to sum what a change has already spent. Give
each worktree its own root and each run sees only itself, so
`budget.maxCostUsd` becomes a per-worktree allowance: three worktrees,
three times the ceiling, silently.

The fix is on the read side, not the write side. Each working directory
keeps writing its own file — one writer per file, no locking, nothing
changed about how a run records itself. The budget check enumerates the
repository's working directories (`git worktree list`) and sums every
one's log.

Deliberately not the other way round. Pointing every worktree's writer at
one shared file would put several processes on one append-and-rotate
path, and rotation rewrites the whole file — two rotations interleaving
lose entries. A read that aggregates cannot lose anything; a write that
aggregates can.

A log that cannot be read is skipped rather than failing the sum. A
sibling worktree that was removed, or belongs to another user, must not
stop this run from starting — and the existing behaviour for an absent
log is already "no recorded usage", not an error.

## Decision: the commands are add, list and remove, and nothing else

`worktree add <change>` prints the exact `run` command for the directory
it created, because the next thing anybody wants is to start the chain
and the path is long.

`worktree remove <change>` refuses a directory with uncommitted work,
because the whole point of the branch is that the work in it is not lost.
No `--force`: git's own `git worktree remove --force` is right there,
spelled clearly, and a destructive flag that this tool adds is one this
tool has to be trusted about.

`run` is unchanged. It is pointed at a worktree with the `--cwd` it
already has. A `--worktree` flag on `run` would couple creating a
directory to starting an agent, and the first of those is cheap and
reversible while the second is neither.

## Non-Goals

Comparing two branches for conflict, semantic or textual. Declaring the
paths a change touches. Merging. Anything that requires two changes to
know about each other beyond what `blocked_by` and `await-change` already
express.

## Risks / Trade-offs

Several chains now run agents at once against one repository's budget,
and each one checks that budget before its own next stage. Two runs can
therefore both pass a check and then both spend, overshooting by one
stage. That is the same race the existing between-stages check has always
had with a single run's own reporting lag (ADR 0018 decision 7: a run's
cost is not known until it ends), widened from one run to several. It is
bounded by one stage per concurrent run, and naming it is better than
pretending the sum is exact.

Disk: a worktree is a full checkout. Three parallel changes are three
copies of the repository, which for this one is tens of megabytes and for
a larger one may not be.

A worktree left behind after its change is archived keeps a branch and a
directory alive. `worktree list` shows them with the change each belongs
to, and says which of those changes are no longer active.
