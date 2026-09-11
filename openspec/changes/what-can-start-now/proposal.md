# What can start now

## Why

Asked for on 2026-09-11, translated because every file here is English:
"We need to provide for a graph of the changes that are running, and
which ones could go in parallel."

Both halves of that exist already and neither is joined to the other.
`change-graph.ts` reads what each change declares about the others —
`follows`, `supersedes`, `blocked_by` — and finds cycles and unmet
blockers. `changes-run-side-by-side` gave a change its own working
directory, and the lease says which of those is busy. What nothing
answers is the question a person actually has in front of them: **which
of these can I start right now, and alongside what.**

There is a second thing nothing answers, and it is the one with teeth. A
change archives by merging its spec delta into
`openspec/specs/<capability>/spec.md`. Two changes whose deltas name the
same capability therefore write to the same file, and running them in
parallel means resolving that by hand at the end.

That is not a hypothesis. In this series, `a-change-runs-from-the-terminal`
and `changes-run-side-by-side` both delivered a delta to
`openspec/specs/ci-cli/spec.md`. They ran one after the other and nobody
noticed. Run in parallel they would have collided, and the collision
would have surfaced at archive — after both had been paid for.

## Capabilities

### New

- Every active change reports its state: running, ready to start, or
  blocked, with the reason attached to the state rather than left to be
  worked out.
- A change that is ready says which other ready changes it can start
  alongside, and which it cannot, naming what they would collide over.
- Whether two changes collide is derived from what they already declare
  and from what their branches already contain — never from a list of
  paths somebody has to maintain.

## Out of scope

A picture. A diagram explains structure; a list is what a person acts
on, and the list is what this builds. Drawing the graph is worth doing
afterwards, against a reader that already exists.

Declaring the files a change touches. A `touches:` list in
`.openspec.yaml` would have to be maintained by hand and would drift
within a week — and a declaration that has drifted is worse than none,
because it is believed. Everything here is derived.

Starting anything. This answers what could start; a person or a schedule
still starts it.

Merging, or predicting a merge. Whether two branches conflict textually
is git's question and git answers it at merge time. What this reports is
the collision that is knowable in advance, which is a different and
smaller claim.
