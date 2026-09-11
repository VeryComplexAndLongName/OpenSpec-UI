# Changes run side by side

## Why

Proposed on 2026-09-10, translated because every file here is English:
"Make it possible to work on several changes in parallel, each in its own
branch, with a compatibility check before merging."

Today a workspace runs one change at a time, and that is not an
oversight. ADR 0010's lease enforces it across hosts, and its own
decision 2 says why: "at most one mutating process in a workspace **until
mutations have independent filesystem isolation**". The lease is a
stand-in for isolation that did not exist.

A git worktree is that isolation. It is a second working directory for
the same repository, on its own branch, with its own files. Two chains in
two worktrees contend for nothing: separate directories, separate leases,
one repository underneath. Nothing in the harness has to be made
concurrent, because nothing is shared.

Three things landed in this series that this one needs, and which is why
it comes last. A change can be run from a terminal, so a run no longer
needs an editor window per branch. A change can declare a step that waits
for another change to land, so a real dependency between two parallel
changes is stated in a file rather than carried by a person. And the
terminal run already takes the workspace lease, so the isolation is
checked rather than assumed.

There is one thing sharing a repository does break, and it is the reason
this change is more than a wrapper around `git worktree add`. Spending is
recorded per workspace. Two parallel runs would each see only their own
audit log, so a configured budget would silently permit its ceiling once
per worktree.

## Capabilities

### New

- A change can be given its own working directory and branch, so several
  changes run at once without waiting for each other.
- A spending ceiling is measured across every working directory of one
  repository, so parallel runs share one budget rather than one each.

### Modified

- The cross-host lease is per working directory, which is what makes it
  the isolation boundary rather than a queue — stated, and tested,
  instead of implied.

## Out of scope

Deciding whether two changes conflict before they merge. That needs each
change to declare the paths it touches, and a comparison of meaning
rather than of lines; both are their own work, and neither is needed to
run two independent changes at once. What this change does give that work
is the place to stand: two finished branches, each with its own history.

Merging. A worktree's branch is pushed and merged exactly as any branch
is, through the review this repository already requires.

Agents talking to each other. A dependency between two changes is
declared — `blocked_by` in `.openspec.yaml`, or an `await-change` step in
a chain — and read from the file by whoever needs it. A schedule carried
in a conversation between two agents is a schedule nobody can review.

Running several changes from one command. One terminal, one change; the
parallelism is several terminals, which is also what makes each run's
output readable.
