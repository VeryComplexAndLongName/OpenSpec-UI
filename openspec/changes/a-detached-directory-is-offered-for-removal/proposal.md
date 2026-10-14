## Why

On 2026-10-13 the owner saw two dashed cards in the Pipeline for work that
had landed days before, one of them a change already archived on `main`
(`cli-is-visible-on-the-homepage`, 0/11) and one a second copy of a change
drawn above. Both came from one working directory,
`C:/Temp/osw-upstream-check`, made on 2026-10-12 for a check against
upstream and left on a detached head at a commit `main` already contained.

Nothing offered to remove it. The directory was on no branch, so the
survey's "finished with" reading (a branch merged or gone) had nothing to
ask, and the standings reading skipped it because it held two changes
(`finishedWorkingDirectories` settles a directory by its one change). The
sweep keeps a directory on no branch on purpose (`no-branch`,
`finished-directories.ts`), and that stays: a clean detached directory at
`main`'s tip is also what a directory made a minute ago for work to come
looks like, and removing it unasked would take it from under somebody.

`what-is-finished-is-tidied-away` and ADR-0034 settled that what is
finished is offered where it cannot be told from what is in use. This
applies that to a directory with no branch.

## What Changes

- **A directory on no branch is finished with where the default branch
  contains its commit.** The survey asks `merge-base` of the directory's
  head against the default branch, as it already does for a branch's tip,
  and says `merged` where the head is an ancestor, the tree is clean and no
  run is recorded against it. It names no branch, since it has none.
- **It is offered, never swept.** The answer appears in the "Left behind"
  list beside a press to remove it, which is what `finishedWith` already
  drives. The sweep does not act on it, and `no-branch` stays what it was
  there.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `openspec-workbench`: a working directory on no branch can be finished
  with, and is offered for removal rather than removed.

## Impact

- **`packages/core/src/worktree-survey.ts`** and
  **`worktree-survey-facts.ts`**: a directory on no branch is a candidate
  for `finishedWith`; its `branch` becomes optional.
- **`worktree-survey.test.ts`**: five tests, one per way the answer is
  given or withheld.
- No new setting, no change to the sweep, the REST shape (`branch` was
  already optional there) or the card. A changeset for `@openspec-ui/core`.
