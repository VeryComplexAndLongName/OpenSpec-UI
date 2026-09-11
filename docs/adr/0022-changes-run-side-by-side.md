# 0022: Changes Run Side by Side, in Git Worktrees

Status: Accepted

Date: 2026-09-11

Completes [ADR-0010](0010-cross-host-workspace-lease.md) decision 2. No
decision there is reversed: the lease stays exactly as written, and this
ADR supplies the filesystem isolation that decision named as its own
precondition.

## Context

ADR-0010 permits at most one mutating process per workspace, "until
mutations have independent filesystem isolation". The lease was never
meant to be the answer to concurrency; it was a guard standing in for
isolation that did not exist, and the sentence saying so has been in the
decision since August.

The owner asked on 2026-09-10 for several changes to be workable in
parallel, each on its own branch. A git worktree is the isolation that
sentence described: a second working directory for one repository, on its
own branch, with its own files and its own `.openspec-ui/`. Two chains in
two worktrees contend for nothing.

Three changes earlier in this series are what make it usable now.
ADR-0020 gave a change a way to run from a terminal, so parallelism no
longer means one editor window per branch. ADR-0021 gave a chain a way to
wait for another change to land, so a real dependency between two
parallel changes is declared in a file. And the terminal run already
takes the ADR-0010 lease, so the isolation is checked rather than
assumed.

One thing sharing a repository genuinely breaks. Spending is recorded per
workspace root, so two parallel runs would each see only their own audit
log and a configured ceiling would silently permit itself once per
worktree.

## Decision

1. **A change may be given its own working directory of the repository,
   on a branch named after the change.** `git worktree add -b <change>
   <path> <base>`. The change is already the unit this product names,
   tracks, reviews and archives; a branch named anything else would be a
   second name for one piece of work, and the two would drift.

2. **The lease is not changed.** It is held per working directory, which
   is what it always described. Two worktrees take two leases and never
   meet; two runs in one worktree still queue exactly as they do today.
   The rejected alternative — making the harness itself concurrency-aware
   — is below.

3. **Creating a worktree refuses, changing nothing, unless the change is
   in the base commit.** `git worktree add` checks out a commit; a change
   that exists only as uncommitted files would produce a working
   directory without the change it was created for: successful and
   useless. The branch not existing and the directory not existing are
   refused on the same terms.

4. **The default location is a sibling of the repository**, not a path
   inside it. A worktree nested in its own main working tree does work,
   but it places a complete second copy of the repository under a
   directory that every recursive tool in the repository will walk.

5. **A spending ceiling is summed across the repository's working
   directories, on the read side.** The chain's audit-reading dependency
   enumerates `git worktree list` and sums every directory's log. Each
   directory keeps writing only its own file.

6. **A log that cannot be read is skipped, not fatal.** A removed
   worktree, or one belonging to another user, must not stop a run from
   starting; an absent log already means "no recorded usage" rather than
   an error.

7. **The commands are `worktree add`, `list` and `remove`, and `run` is
   unchanged.** A worktree is reached with the `--cwd` the run command
   already has.

## Rejected Alternatives

### Make the harness concurrency-aware instead

Rejected. It would touch the chain runner, the process scheduler, the run
journal and the audit log, and each would then carry a concurrent path
exercised only when two people happen to start two changes at once — the
worst possible test coverage for the worst possible failure. Worktrees
make the question not arise: separate directories, separate files,
separate leases, one repository underneath.

### Relax the lease to one per change rather than one per directory

Rejected: it would permit two mutating runs in one working directory,
which is the thing ADR-0010 exists to prevent, and it would do so in
exchange for nothing — the worktree already separates them.

### Point every worktree's audit writer at one shared file

Rejected, and this is the decision most likely to be revisited by someone
who has not thought it through. `FileAuditLog` appends and then rotates
by rewriting the whole file; several processes on that path will
interleave two rotations and lose entries. A read that aggregates cannot
lose anything. A write that aggregates can.

### Let the run command create the worktree itself

Rejected: it couples creating a directory — cheap, reversible, safe — to
starting an agent, which is none of those. Two commands, and the first
prints the second.

### Have the two agents agree between themselves what to wait for

Rejected, as it was when proposed: a schedule carried in a conversation
between two agents is a schedule nobody can review, and it exists only
while both are running. `blocked_by` in `.openspec.yaml` and ADR-0021's
`await-change` step both state the same thing in a file, in the
repository, where a person reads it.

### Decide whether two branches conflict before merging

Deferred, not rejected. It needs each change to declare the paths it
touches and a comparison of meaning rather than of lines. Neither is
required to run two independent changes at once, and this change is what
gives that work somewhere to stand: two finished branches, each with its
own history.

## Consequences

- Several chains can spend against one budget concurrently, and each
  checks before its own next stage, so two runs may both pass and then
  both spend — overshooting by at most one stage per concurrent run. This
  is the existing between-stages race (ADR-0018 decision 7) widened from
  one run to several, and is named rather than papered over.
- A worktree is a full checkout, so three parallel changes are three
  copies of the repository.
- A worktree can outlive the change it was made for. `worktree list`
  marks those whose change is no longer active.
- ADR-0010's decision 2 is now satisfied rather than pending, and the
  lease has a stated, tested meaning instead of an implied one.
