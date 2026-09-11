---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

Changes run side by side, each in its own git worktree.

`openspec-ui-cli worktree add <change>` gives a change its own working
directory of the repository, on a branch named after it; `worktree list`
and `worktree remove` manage them. Two chains in two working directories
take two leases and never meet, which is the filesystem isolation ADR
0010 decision 2 named as its own precondition — the lease itself is
unchanged.

A spending ceiling is now summed across every working directory of the
repository rather than per directory, so parallel runs share one budget
instead of one each. The aggregation is on the read side: each directory
keeps writing only its own log.

Creating a working directory refuses, changing nothing, where the change
is not in the base commit, where the branch is already checked out, or
where the directory exists. Removing one refuses where it still holds
uncommitted work.
