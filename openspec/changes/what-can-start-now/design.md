# Design

## Decision: collision is derived, never declared

The obvious design is a `touches:` list in `.openspec.yaml` naming the
paths a change will edit. It is rejected, and this is the decision the
rest of the change hangs off.

A declaration like that has to be written before the work and maintained
during it, by the person least able to predict it — the one who has not
done the work yet. It drifts in a week. And a drifted declaration is
worse than an absent one, because it is believed: a change that says it
touches nothing gets started alongside one it will collide with, and the
report that permitted it looked authoritative.

Everything here is read from what already exists.

## Decision: the three things that make two changes collide

**A declared blocker.** `blocked_by` in `.openspec.yaml`, already read by
`change-graph.ts`, already resolved the moment the named change is
archived. This is a hard edge and needs nothing new.

**A shared capability.** A change delivers
`openspec/changes/<id>/specs/<capability>/spec.md`, and `openspec
archive` merges it into `openspec/specs/<capability>/spec.md`. Two
changes naming the same capability write to the same file at archive.
This is free, available before either change has been started, and it is
not a guess — it is the same path twice.

**Overlapping work in progress.** Once a change has a working directory,
`git diff --name-only <base>...<branch>` is exactly the files it has
touched so far. Precise, cheap, and available only after work has begun
— which is why it supplements the capability check rather than replacing
it.

The first two answer before anything is spent. The third sharpens the
answer once there is something to sharpen it with.

## Decision: parallel means a working directory each

The cross-host lease permits one mutating run per working directory (ADR
0010, as completed by ADR 0022). Two changes cannot run at once in the
same directory whatever their relations say, so a change with no
worktree of its own is not startable in parallel — it is startable
instead of, not alongside.

The report says so rather than leaving it to be remembered, because the
remedy is one command and naming it is most of the help.

## Decision: a state carries its reason

`blocked` without "by what" is a state a reader has to go and
investigate. Every state carries the fact that produced it: the change
that blocks it, the capability two changes share, the file both branches
have touched, the host holding the directory.

This is the same shape `ChainStartRefusal` already uses, for the same
reason — a refusal a reader can act on names what governs it.

## Decision: pairwise, and reported from each side

"Can run in parallel" is not a property of a change; it is a property of
a pair. The reader returns, for each ready change, the other ready
changes it can join and the ones it cannot with the reason.

Deliberately not a single "parallel group". Three changes where A and B
collide and C collides with neither has no one grouping — presenting one
would mean choosing for the reader and hiding that the choice existed.

## Decision: one command, and it answers the question it is named for

`openspec-ui-cli ready` prints every active change with its state, and
under the ready ones what each can start alongside. `change-graph` is
left alone: it renders declared relations, which is a different job, and
folding a runtime state into it would make one command answer two
questions badly.

## Non-Goals

A diagram. Starting anything. Predicting a textual merge conflict, which
is git's question. Declared path lists, per the first decision.

## Risks / Trade-offs

The capability check is coarse: two changes can both add requirements to
one capability's spec and merge cleanly, because they touch different
parts of the file. It reports a collision that git might have resolved
by itself. That direction of error is the right one — it warns where
nothing happens, rather than staying quiet where something does — but it
will sometimes say "these two will collide" and be wrong about how much
it costs. The report says which capability, so the reader can judge.

Reading a branch's diff means running git per worktree. For the handful
of worktrees a person has open that is nothing; it is bounded by the
number of working directories, not by the number of changes.
