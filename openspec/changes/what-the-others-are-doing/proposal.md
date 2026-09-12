# What the others are doing

## Why

On 2026-09-12 two agents worked on this repository at once — one in the
primary checkout, one in a working directory beside it — and the owner
could see only their own. Six proposals sat one directory away, written
and invisible.

The tool answered honestly and uselessly. It reported the queue of the
directory it was pointed at, which happened to be sitting on a branch
whose pull request had already merged, so it said there were no active
changes. Nothing on screen named the branch it had read, so "there is
nothing to do" and "you are looking at a stale checkout" looked
identical.

A second thing went unnoticed in the same session: a change archived in
one directory was still present, as a tracked file, in another. It came
along with the branch point, put there by nobody. Harmless while
untouched, and a real collision the moment either copy is edited.
Nothing reports it today.

The parts to fix both are already here. `changes-run-side-by-side` gave
each change a working directory; `what-can-start-now` derived what is
running from the lease each one holds; `a-lease-says-who` made the lease
say whose run it is; `a-graph-of-what-is-running` drew the result. Every
one of them stops at the edge of the directory it was given.

Nothing about that edge is expensive to cross. A working directory is
not a remote thing: `git worktree` shares one object store, and the
sibling's `.git` is a file naming a subdirectory of this one. The survey
is a local read, with no daemon, no network and no registry.

## What Changes

- A **survey** of every working directory of this repository: its label,
  the branch it has checked out, the changes in its own queue, how far
  each one's tasks have got, and who holds it where a run does.
- The pipeline tab shows each directory's changes as their own picture —
  this one at full strength, the others recessed beneath it. Nothing
  foreign enters the local order, and no relation is drawn between
  directories.
- Foreign changes carry **no action at all**. Read-only is what the view
  can do, not how it looks.
- Each directory carries a **label**, defaulting to its own directory
  name and overridable by a file in it. Self-declared: attribution,
  never authentication.
- Where a directory's lease records a **git author different from this
  checkout's**, the survey says so — in a word, agreed with by colour,
  never carried by colour alone.
- A change present in more than one directory at once is **reported**,
  not prevented and not resolved.
- The tab **names the branch each reading came from**, so an empty queue
  is not mistaken for a stale checkout.
- **No git is run against a directory this host does not own.** One
  `git worktree list` enumerates them; everything after that is a
  filesystem read.

## Impact

- `packages/core` — a survey module beside `change-readiness`, reading
  directories rather than deriving new facts about them.
- `packages/server` — one endpoint carrying the survey.
- `packages/webui` — the foreign bands under the local picture, and the
  branch each reading names.
- No new dependency, no background service, no configuration required
  for a directory to appear.

See `docs/adr/0026-other-working-directories-are-observed-never-touched.md`.
