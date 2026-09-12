# A hint says what can run together

## Why

Everything needed to tell somebody "these two changes can be started at
once, and here is the command" is already computed.
`readChangeReadiness` in `packages/core/src/change-readiness.ts` returns,
per active change, its run state, the capabilities its delta touches,
`canJoin`, `blockedFrom` with the exact collisions, and `needsWorktree`
with the remedy. `openspec-ui-cli ready` prints it. Nobody is told
anything: a person has to read a report and work out what to do with it.

Raised in review on 2026-09-12: the tool should point out the
non-obvious — that these changes could run in parallel, that this work
could be split — and offer to set it up, with the whole thing
switchable off.

The gap is not a computation. It is that a fact is printed where an
offer would help, and that the fact is only printed when somebody thinks
to ask for it.

ADR 0001 decides where such a thing may live: all behaviour in
`packages/core`, with `server` and `extension` as thin adapters. A hint
computed in a UI would exist in one host and not the other, and could
not be tested without that host.

## Capabilities

### New

- A hint: a named, explained suggestion derived from facts the
  repository already computes — which ready changes can be started
  alongside each other, which ready change has nowhere to run and the
  one command that gives it one, which change is held by a run that
  ended.
- The commands a hint suggests, quoted exactly, so acting on one is
  copying a line rather than translating a suggestion.
- `openspec-ui-cli advise`: the same hints in a terminal, text or JSON.
- A setting that turns hints off, under which nothing is computed at
  all.

### Modified

- The standalone shell and the extension show hints where they already
  show readiness, using the shared component rather than one each.

## Out of scope

Writing anything. A hint never creates a worktree, edits a change, or
starts a run. It names the command; a person runs it.

Writing a change. "Let me write a small change that runs all of this
optimally" was the review's own phrasing, and generating an OpenSpec
change from a guess is the one thing this must not do: a change is a
document somebody is accountable for. What this offers is the plan and
the commands. If a generator is wanted later, it is a change of its own,
gated on an explicit confirmation, and it starts from hints that have
been in use long enough to be trusted.

Choosing one grouping. `readChangeReadiness` is deliberately pairwise —
"three changes where A and B collide and C collides with neither have no
single correct grouping, and presenting one would choose for the reader
and hide that a choice existed". A hint that announced the optimal plan
would undo that decision quietly.

Anything running in the background on a timer. See `design.md`.
