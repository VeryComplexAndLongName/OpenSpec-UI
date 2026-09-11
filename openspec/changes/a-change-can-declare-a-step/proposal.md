# A change can declare a step

## Why

Proposed on 2026-09-10, translated because every file here is English:
"Make it possible for a change to have non-standard steps in its chain."

The chain is six fixed stages in one fixed order: `propose → review →
apply → verify → archive → git`. A change can say who runs each stage,
with what model, under what ceiling, and whether to pause between them.
It cannot say that anything else happens.

That is usually right. A sequence every change shares is what makes one
change's run readable to someone who has only ever watched another. The
case it does not cover is a change that genuinely has to wait on
something outside itself — and the next change in this series, parallel
changes in worktrees, is made entirely of that case. Two changes editing
one interface need the second to reach `verify` only after the first has
landed. Today the only way to express that is for a person to watch two
runs and start the second by hand, which is the thing this whole series
exists to stop doing.

There is a second reason to do it now rather than inside the parallelism
change. `waitForExternalSignal` (`external-waiter.ts`) has existed since
`harness-suspendable-stage` and has **no consumer** — a poller built for
a future caller that never arrived. A capability nothing uses is exactly
what this repository refuses to keep; either it gets its first consumer
here, or it should go.

## Capabilities

### New

- A change may declare additional steps in its chain, each a name from a
  registry the core owns, at a stated position relative to the fixed
  stages.
- A chain can wait for another change to land before continuing, and say
  so in its own file rather than in a person's head.

### Modified

- The chain's sequence is what the change declares, not a constant —
  while the six fixed stages remain fixed, present, and in order.
- A stage entry may name only a stage that runs an agent, decided from a
  list of those stages rather than from a list of the ones that do not.

## Out of scope

A free-form command. A declared step names an entry in a closed registry
this repository owns, exactly as a `check(...)` declaration does (ADR
0019). A repository file supplies data; it never supplies something to
execute. This is the line the whole capability sits on.

Removing or reordering a fixed stage. A declaration inserts; it cannot
say that `verify` does not happen, or that `archive` comes first.

A registry full of steps nobody calls. It opens with the one entry there
is a consumer for. A second entry belongs to the change that needs it,
which is how the mechanical-check registry was built and why every name
in it is used.

Deciding deadlocks between two waiting changes. Two changes waiting on
each other is possible and is not detected here; each wait has its own
maximum duration and fails saying what it waited for. Naming the real
answer rather than pretending: the declared `blocked_by` relation is
where a cycle is already detected, and connecting the two is its own
change.
