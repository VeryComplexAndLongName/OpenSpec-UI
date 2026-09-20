## The signal, and why it is git's

A pull request merges, GitHub deletes its branch, and the next
`git fetch --prune` drops the remote-tracking ref. The local branch then
has an upstream that no longer exists, and git says so in one word:

```
a-run-budget-has-a-unit  13b9f9db [origin/a-run-budget-has-a-unit: gone]
```

`gone` is the whole signal. It says two things at once that nothing else
here says together: the branch **was** pushed, so its work is not only
local; and what it was pushed to has been deleted, which in this
repository happens when a pull request merges, because
**Automatically delete head branches** is on.

Read with `git for-each-ref --format='%(refname:short) %(upstream)
%(upstream:track)' refs/heads`, which answers for every branch in one
call and needs no network.

What it is not:

- **Not a merge base.** This repository squashes, so a branch's tip is
  never an ancestor of `main`. The existing reading says this already.
- **Not `gh`.** A directory should not stay for ever because a token
  expired. The pull request is a better answer when it is available and
  no answer at all when it is not.
- **Not the change.** The sixth directory here is for a change that was
  withdrawn from `main`; it has no standing to hang an answer on, and git
  answers for it like any other.

## The prune is part of the reading

`gone` appears only after a fetch that prunes. A reading that skips it
answers from whatever the last fetch left behind, which for this
repository was a dozen branches deleted days ago and still listed.

So the reading fetches with `--prune` first, and where the fetch fails it
says so and keeps every directory. A stale answer that removes something
is worse than no answer.

## What is actually deleted, tested

`git worktree remove --force`, then whatever shell is left.

Both halves were tested against a real junction on 2026-09-20, because
every working directory on this machine holds `node_modules` as a
junction to the main checkout's, and a delete that followed it would take
the repository's dependencies with it:

- `git worktree remove --force` unregistered the worktree and deleted the
  files it owned. It did **not** follow the junction: the target's file
  was still there afterwards. It left a shell directory holding the
  junction, which is the "empty shell on Windows" the runbook already
  names.
- `rmdir` on the junction unlinked it and left the target intact.
- Node's `fs.rm(path, { recursive: true })` over the shell also unlinked
  the junction rather than following it, and the target survived.

So no special handling is needed, and this is written down because the
absence of a hazard is exactly what a later hand-rolled directory walker
would quietly reintroduce. A test holds it.

## What keeps a directory

Each of these keeps it, and each says which one it was:

- **The tree is not clean.** Somebody's uncommitted work, however old.
- **A run is recorded against it.** Something is using it now.
- **The branch has no upstream.** It was never pushed, so nothing landed.
- **The upstream is still there.** The pull request has not merged, or
  the branch was pushed and nothing has happened to it yet.
- **The fetch failed.** The answer would be from a stale reading.
- **It is the main working directory.** It is where the default branch
  lives.

## The change is not touched

A directory sweep removes directories. It does not archive a change,
delete one, or edit one. `openspec/changes/` is repository content, and
the owner put it plainly on 2026-09-20: the change is already part of the
repository.

That the word on a change's card reads "finished" from a merged pull
request while its tasks are open is a real defect, and a separate one: it
is about what a change's status is, not about what a directory is for.
It is the next change.

## A decision reversed, and why

`vscode-extension` says today, in as many words, that removing a leftover
or a working directory that is finished with "SHALL be a command the
person runs, never part of the sweep". That was deliberate: a working
directory can hold somebody's work, and deleting one unasked is the kind
of help nobody thanks you for.

The owner reversed it on 2026-09-20, and the reason it is safe to reverse
is the asymmetry. Every rail that made the old rule cautious still holds -
a directory is removed only with a clean tree, no run against it, and a
branch that was pushed and whose remote is gone - and past those rails
there is nothing to lose: the branch stays, its commits stay, and the
directory is one `git worktree add` from existing again. Against that, a
press nobody makes leaves six directories, and the crowd is what the owner
actually experiences.

So the press becomes a report. What was removed, and why, is said in the
same row that used to ask.

## Removed, not offered

The reading fed a row with a press. Six directories accumulated, which is
what a press nobody remembers looks like after a day.

So the sweep removes, and says what it removed and why - the same row,
reporting rather than asking. Nothing is lost by being wrong: the branch
stays, its commits stay, and a working directory is one
`git worktree add` away. That asymmetry is why this one acts rather than
asks, where archiving a change does not.
