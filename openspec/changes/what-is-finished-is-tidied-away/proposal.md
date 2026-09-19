## Why

The owner, on 2026-09-19, after three directories under `.worktrees`
refused to go and the Pipeline showed a wall of cards: "Is there a process
that clears empty folders and tidies `.worktrees`? ... In Pipelines I see a
crowd of changes. Not started, started, finished. ... A lot of them are
finished. Why are they not in the archive? This needs managing."

The crowd itself was a stale working copy - seventeen commits behind, so
the archived changes were still active in it. But four real defects came
out of looking:

- **An empty directory is never cleared.** `the-workspace-clears-what-it-
  left-behind` clears a leftover only when every file in it is one the
  product wrote, and an empty directory has no files, so the rule reads
  false. The case the owner asked about first is the one case the sweep
  refuses.
- **Nothing sweeps `.worktrees`.** `git worktree remove` leaves the
  directory shell behind on Windows, where a junction was in it. Git no
  longer lists it, so the survey does not see it either, and it sits there
  holding nothing.
- **"Finished with" is decided by a merge base, and this repository
  squashes.** A squashed branch's tip is never an ancestor of `main`, so
  the reading that was meant to say "this directory has nothing left to
  do" says it almost never. What actually settles it is already read
  elsewhere: the change's pull request, and whether `main` has the change
  archived.
- **A directory that will not go says only what the operating system
  says.** Three of them were held by servers this product's own live
  checks had started days earlier and never stopped. "Access denied" is
  not an answer a person can act on; the name of the process is.

And the Pipeline draws every active change as a card, however finished.
It knows the difference - the standing word says "Archived on main",
"Merged in #N", "Done" - and draws them alike anyway.

## What Changes

- **An empty leftover is cleared** where its change is archived, on the
  same rule as one holding only this product's own files.
- **The working directories are swept too.** A directory under the
  worktree root that git no longer lists as a working directory, and that
  holds no files, is reported and cleared with the rest.
- **"Finished with" reads what settles it**: the change's pull request
  merged, or `main` carrying the change archived, beside the branch being
  gone. A merge base still counts, for repositories that do not squash.
- **A refusal names who is holding the directory**, best effort, from the
  processes whose command line mentions it - which is exactly how the
  three servers were found.
- **The Pipeline folds what is over.** Cards whose standing says the work
  has landed fold into one row with their count, one press archives them
  all, and the picture takes a filter like the editor's three views.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `execution-core`: what counts as a leftover, where the sweep looks, what
  makes a working directory finished with, and what a refusal says.
- `shared-ui`: the Pipeline folds finished cards, offers to archive them
  and can be narrowed.

## Impact

- **`packages/core`**: `workspace-leftovers.ts` (the empty rule, the
  worktree-root sweep, the holder reading), `worktree-survey.ts` and
  `change-standing.ts` (what finished with means).
- **`packages/webui`**: `PipelineView.tsx` and its stylesheet.
- **`packages/server`** and **`packages/extension`**: the archive action
  the folded row needs, and the leftovers route's reading.
