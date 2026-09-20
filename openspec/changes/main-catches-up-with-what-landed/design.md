## Context

`change-standing.ts` already fetches refs at most once per interval, reads
`refs/remotes/origin/*`, and reads the archive on the default branch to say
"Archived on main". `GitWrapper` has `resolveCommit`, `mergeBase`,
`listRefs` and `status`, and no way to count commits between two refs or to
move a branch.

`PipelineView` takes its facts through injected readers - `refresh`,
`survey`, `standings` - each host passing its own. A card of another
working directory is drawn by `ForeignChanges`, whose detail lines come
from `foreignDetails`, which today knows nothing of standings.

## Goals / Non-Goals

**Goals:**

- Say how far behind the checkout is, in the window the person watches.
- Say which of the changes in front of them are already over.
- Close the gap in one press, or refuse in words.

**Non-Goals:**

- Any git operation that can conflict.
- Moving anything without a press.

## Decisions

### The distance is counted, not guessed

`git rev-list --left-right --count <branch>...<remote>/<branch>` answers
both directions in one call. Behind is what this reading is for; ahead is
read in the same breath because it is what makes a fast-forward
impossible, and a refusal that cannot say why is worse than none.

**Rejected: a merge base and two logs.** Two calls, same answer, and the
merge base is already read for another purpose - reusing it here would tie
two readings that answer different questions.

### Catching up is `merge --ff-only`, guarded three ways

The wrapper gains `fastForward(ref)`, which runs exactly
`git merge --ff-only <ref>`. Before it runs:

- the tree must be clean, by the same `status()` the rest of the product
  reads. A fast-forward over uncommitted work can overwrite it;
- the branch must have nothing the remote lacks. `--ff-only` would refuse
  anyway; refusing first lets the message say "your branch has 2 commits
  origin/main does not" instead of git's;
- the branch must be the checkout's default. Catching up a feature branch
  with `origin/main` is not what the press says it does.

**Rejected: stashing and reapplying.** A product that stashes a person's
work and hands it back is a product that will one day not hand it back.

### The Pipeline says it above the picture

One line where the reader already looks for what this checkout is, beside
"Read from branch main". It says the number of commits and how many of the
changes drawn are archived on the default branch, because those two facts
explain each other: a wall of cards that are already over is what being
behind looks like.

### A foreign card says "archived on main"

`foreignDetails` takes the standings it is given and adds the line the
change's own card would carry. It is the case the owner met: a change
worked in another directory, landed and archived, still drawn as if it
were alive.

## Risks / Trade-offs

- **The count is as fresh as the last fetch.** The line says when refs
  were last fetched, as the standings already do, so a stale number is
  readable as stale.
- **A fast-forward that fails part way.** It cannot: `--ff-only` either
  moves the pointer or refuses.
- **One more git call per reading.** One `rev-list`, on the same interval
  as the standings, against refs already fetched.
