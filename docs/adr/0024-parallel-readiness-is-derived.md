# 0024: Parallel Readiness Is Derived, Never Declared

Status: Accepted

Date: 2026-09-11

## Context

ADR-0022 gave a change its own working directory, so two changes can run
at once. It deferred one thing explicitly: "Deciding whether two changes
conflict before they merge... needs each change to declare the paths it
touches, and a comparison of meaning rather than of lines."

The owner asked on 2026-09-11 for a view of the changes that are running
and which could go in parallel. The halves exist separately —
`change-graph.ts` reads what each change declares about the others, and
the cross-host lease says which working directory is busy — and nothing
joins them into the question a person actually has: which of these can I
start right now, and alongside what.

There is a collision this project can know about in advance, and it has
already happened unnoticed. A change archives by merging its spec delta
into `openspec/specs/<capability>/spec.md`. In this series,
`a-change-runs-from-the-terminal` and `changes-run-side-by-side` both
delivered a delta to `openspec/specs/ci-cli/spec.md`. They ran one after
the other. Run in parallel they would have met in that file, and the
meeting would have surfaced at archive, after both had been paid for.

## Decision

1. **Collision is derived from what already exists. A change never
   declares the paths it will touch.** The obvious design — a `touches:`
   list in `.openspec.yaml` — is rejected below, and this is the
   decision the rest hangs off.

2. **Three sources, and each is reported as itself.**
   - A **declared blocker** (`blocked_by`): free, exact, already read by
     `change-graph.ts`, already resolving when the named change is
     archived.
   - A **shared capability**: two changes whose deltas name the same
     capability write to the same merged spec file at archive. Free,
     coarse, and available before either change has been started.
   - An **overlapping branch**: `git diff --name-only <base>...<branch>`
     for a change that has a working directory. Cheap, precise, and
     available only once work has begun.

   The first two answer before anything is spent; the third sharpens the
   answer once there is something to sharpen it with. They are not
   merged into one score — a reader acts differently on "these two edit
   the same file" than on "these two touch the same capability".

3. **A state carries the fact that produced it.** `blocked` names the
   blocker, `running` names the directory and its holder, a collision
   names the capability or the file. This follows `ChainStartRefusal`'s
   shape for the same reason: a reader can only act on a reason that
   names what governs it.

4. **The answer is pairwise, never one group.** Three changes where A
   and B collide and C collides with neither have no single correct
   grouping. Presenting one would choose for the reader and hide that a
   choice existed.

5. **Running in parallel requires a working directory each**, because
   the lease permits one mutating run per directory (ADR-0010, completed
   by ADR-0022). A change without one is startable *instead of* another,
   not *alongside* it, and the report says what would change that.

## Rejected Alternatives

### A `touches:` list in `.openspec.yaml`

Rejected, and it is the central rejection. Such a list is written before
the work, by the person who has not done it yet and therefore knows
least about what it will touch; it must then be maintained by hand while
the work changes shape.

It drifts within a week. **A drifted declaration is worse than an absent
one, because it is believed**: a change claiming to touch nothing gets
started alongside one it will collide with, and the report that
permitted it looked authoritative. Every source in decision 2 is read
from something that cannot drift, because it is the thing itself.

### Predict the textual merge conflict

Rejected: whether two branches conflict is git's question, and git
answers it exactly, at merge. Re-deriving a worse version of that answer
in advance would be wrong more often than it was useful. What this
reports is the smaller, knowable claim — that two changes are heading
for the same file — which git cannot tell anyone before the file exists.

### One "parallel group" of changes that may run together

Rejected per decision 4: it is not computable without choosing on the
reader's behalf.

### Fold the state into `change-graph`

Rejected: `change-graph` renders declared relations, which is a
different question from what is runnable now. One command answering two
questions answers both badly, and the relations view is useful precisely
because it shows the durable structure rather than today's state.

### Draw it

Deferred, not rejected. A diagram explains structure; a list is what a
person acts on. The list is built first, and a diagram afterwards has a
reader to draw from.

## Consequences

- The capability check is coarse: two changes can both add requirements
  to one capability and merge cleanly, having touched different parts of
  the file. It will sometimes warn where nothing would have happened.
  That is the right direction of error — it is quiet only where it knows
  nothing — and the report names the capability so the reader can judge.
- Reading a branch's diff costs one git invocation per working
  directory, bounded by how many a person has open rather than by how
  many changes exist.
- `WorkspaceLeaseManager` gains a read-only peek. Everything that
  touches the lease today acquires it, and a reporter must be able to
  look without taking.
- The parallelism ADR-0022 enabled becomes usable without a person
  holding the dependency graph in their head.
