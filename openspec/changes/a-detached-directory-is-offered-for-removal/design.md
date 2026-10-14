## Context

`markFinishedDirectories` in `worktree-survey.ts` marks a directory
`finishedWith` where its branch is merged into the default branch or no ref
of that name is left, its tree is clean and no run is recorded. The mark
is what the "Left behind" list offers a press beside; it is "never a
removal" (`worktree-survey-facts.ts`). Directories on no branch were
excluded at the start, and the sweep excludes them again as `no-branch`.

## Goals / Non-Goals

**Goals**

- A clean, runless directory whose head `main` already contains is offered
  for removal, with the same words a merged branch gets.
- Nothing that is removed unasked.

**Non-Goals**

- Sweeping such a directory. `no-branch` stays in
  `finished-directories.ts`.
- Reading the directory's own changes or standings. It is the commit, not
  its content, that says the work is on the server.
- Changing how cards from such a directory are drawn.

## Decisions

### Ask `merge-base`, as for a branch

The head is the tip. `git.mergeBase(mainCommit, head) === head` is the
same test a pushed branch gets, and it needs no new git call: the survey
already lists refs once and has `mergeBase`. The default branch is
`origin/main`, else `main`, as it is for a branch.

### The reason is `merged`, and no branch is named

`finishedWith.reason` is `"merged"` ("the default branch already contains
its tip"), which says exactly this. `branch` becomes optional; the
standings reading, the REST fallback and the client type already carry it
as optional, and compliance reads only the reason.

### Offered, not swept

A directory at `main`'s tip with a clean tree is also what a directory made
for work about to start looks like, and the product cannot tell the two
apart. Removing a clean directory loses nothing that is not on the server,
but it can remove one somebody is about to work in, or whose shell an agent
is standing in. A press leaves that to a person. Rejected: adding the same
test to the sweep, which would have been the shortest change and would have
removed exactly that directory.

Also rejected: hiding the dashed cards a directory like this draws.
`foreignDetails` already says "archived on main" on a card whose change the
default branch carries archived, and a directory that is offered for removal
is where the rest of the clutter goes.

## Risks / Trade-offs

- **A directory made a minute ago for work to come is offered at once.** It
  is a press, and a person who made it knows. This is the cost of offering
  without being able to tell.
- **A head not on `origin/main` by a fetch not yet made** is not offered
  until the next fetch; the survey reads the refs it has, as for branches.
