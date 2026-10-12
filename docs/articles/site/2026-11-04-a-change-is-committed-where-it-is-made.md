---
title: A change is committed where it is made
summary: Agent workflow rules now say when to commit and push. A new change is committed and pushed as it is made. A card of a change's own worktree offers Commit Change, and the git stage commits what the stages left.
cover: cover.jpg
cover_alt: The OpenSpec Workbench owl, pushing, beside the words A change is committed where it is made
---

A change worked in its own worktree — since ADR 0043 the usual change —
could have its own harness set nowhere but in the file. The Changes tree
drew such a change as one worked "elsewhere" and gave it a shortened menu,
and the Pipeline's card offered only Start, the run's controls and Logs.
Every control added to the tree and not to the card, or the other way
round, left one host or one kind of change poorer.

The owner decided the same day: when a change is made, everything needed
is done, so the change can be worked at once as one's own.

## The rules, now with when

The agent workflow rules say when: commit the planning artifacts on the
change's branch and push it with an upstream as soon as they are written;
commit and push after every task ticked; leave nothing uncommitted or
unpushed at the end of a turn; nothing of a change on `main`; a refused
push is said, not worked around.

Create Change, in both hosts, commits the new change on its branch and
pushes it at once. A refused push leaves the change made and says why
(`OSW-GIT-203`).

The `git` stage commits what the stages left before it pushes
(`OSW-GIT-103` where that commit fails).

## The survey and the card

The survey says where a change's own branch is not on the server: never
pushed, or at another commit. Read from the refs it lists anyway, so no
git runs in the directory.

A card of a change's own worktree says so ("not on the server"), and a
new action, **Commit Change**, commits everything the worktree holds on
the change's branch and pushes it. On the card and in Show Actions..., in
both hosts; refused in the main checkout and on the default branch.

A card of a change's own worktree offers its actions in the arrangement
by step as on the board, and **Run Change...**: the owner found on
2026-10-10 that such a change could be acted on but never run — a card's
Start was refused for a change this checkout does not have. It runs in
the change's worktree, in both hosts.

## Messages in the new GIT group

Messages in the register's new GIT group (`OSW-GIT-001`..`203`) name
every failure, refusal and success in the commit and push path. ADR 0043
is amended to reflect the new rules.

## What this deliberately does not do

The product does not auto-merge. It does not open pull requests on your
behalf. It commits and pushes; the merge gate, the archive pass and the
forge integration handle the rest. A refused push is said, not worked
around, and the change is left in a state where you can decide what to do
next.

The Commit Change action is refused in the main checkout and on the
default branch. It only works on a change's own worktree, where the
change's branch is the current one.

## Try it

The code is at
[github.com/VeryComplexAndLongName/OpenSpec-UI](https://github.com/VeryComplexAndLongName/OpenSpec-UI),
where the repository and packages keep the name OpenSpec-UI.

```bash
openspec-ui-cli commit change --cwd .
```
