# Design

## Decision: the guard applies only where it can mean something

The non-vacuity assertion runs when the workspace has at least one
active change. With none, the drift check is still run and still
asserted to find nothing — the behaviour under test does not change —
but the count of delta specs is not required to be positive, because
zero is the correct count.

Reversing it, and demanding at least one active change, was rejected
outright: that makes an empty queue a build failure, which is what went
wrong.

## Decision: the empty case gets its own test, over a fixture

The repository-level test cannot cover the empty case, because the
change that fixes it is itself an active change — the moment it exists,
the branch it fixes is no longer taken. A fixture workspace with no
changes is what proves the check survives that state, and it keeps
proving it after this change is archived and the repository is empty
again.

That is the whole trap here. A fix verified only by "the suite is green
now" would be verified by the presence of the fix, not by the code.

## Non-Goals

Changing `checkSpecDeltaDrift`. It already returns an empty list for an
empty workspace; nothing about the check is wrong.

## Risks / Trade-offs

The guard is weaker in exactly one state: a repository with no active
changes cannot notice that spec-id resolution has broken. It also has
nothing to notice it against, so the loss is nominal. The moment a
change is proposed the guard is back at full strength.
