## Why

Seven working directories exist on this machine. Six of them are for work
that landed hours ago: clean trees, no runs, their branches deleted from
the server when their pull requests merged. All six are still drawn in the
Pipeline, and the owner reads that as a crowd of live work - "a lot of
stress for the user", as they put it.

The product already has the reading -
`finishedWorkingDirectories` - and it does answer correctly for five of
the six. Two things are wrong with it anyway:

**It asks GitHub, not git.** The reason it accepts is "the change's pull
request merged", read through `gh`. Where `gh` is not authenticated, rate
limited, or simply offline, nothing is ever finished with. And it needs a
change to hang the answer on: the sixth directory, whose change was
withdrawn from `main`, matches nothing and stays for ever.

**Nothing removes anything.** The reading feeds a row that offers a press.
Six directories accumulated because a press nobody remembers is a press
nobody makes.

The owner set the rule on 2026-09-20: look at git. A directory is there,
it is not empty, so ask git what the state of it is; merged means delete
the directory, and that is all. The change itself is not touched - it is
part of the repository already, and archiving it is a governed act, not a
sweep.

## What Changes

- **git settles it.** A directory is done when git says its branch was
  pushed and the branch it tracked is gone - which is what a merged pull
  request leaves behind in a repository that deletes its branches on
  merge. No `gh`, no change, no merge base.
- **A prune comes first.** `git fetch --prune` is what turns a deleted
  remote branch into the `gone` that the reading depends on. Without it
  the answer is silently stale.
- **Done means removed.** The sweep removes the directory rather than
  offering a press, and says what it removed and why.
- **A junction is unlinked, never followed.** A working directory on this
  machine holds `node_modules` as a junction to the main checkout's. A
  recursive delete that follows it would take the main checkout's
  dependencies with it. Reparse points are removed as links, and what
  they point at is never read.
- **The rails stay.** A tree that is not clean, a run recorded against the
  directory, a branch that was never pushed, a prune that failed: each
  keeps the directory, and each says which one it was.
- **The change is not touched.** No directory sweep archives, deletes or
  edits a change. `openspec/changes/` is repository content.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - what settles that a working directory is done, and
  what happens to one that is.
- `vscode-extension` - the sweep removes and says so.

## Impact

- `packages/core/src/change-standing.ts` (the reading) or a module of its
  own, `packages/core/src/git.ts` (the upstream's state, the prune), and
  the sweep the extension runs.
- A changeset: core and the extension both change.

## Explicitly out of scope

- **Touching a change.** Archiving stays a governed act with its own
  pull request. A sweep that edited `openspec/changes/` would be a sweep
  that rewrites the repository.
- **Deleting the branch.** The directory goes; the local branch stays.
  A branch costs nothing and holds the commits if the remote branch was
  deleted without merging, which git cannot tell apart from a merge.
- **The word on a change's card.** That a merged pull request reads as
  "finished" while tasks are open is a real defect, and it is about
  changes rather than directories. It is the next change.
- **Directories belonging to another person.** The sweep touches what
  this machine's git reports as its own working directories, which is
  what `git worktree list` answers and nothing more.
