# A change without a design is not an unproposed change

## Why

A resumed chain decides where to start by asking whether the proposing
stage finished. It requires three artifacts to be done — `proposal`,
`design`, `tasks` — and a change that deliberately has no `design.md`
never satisfies that.

Read from this repository on 2026-09-09, for
`dialog-shows-what-runs-cost`, which is implemented and 18 of 19 tasks
checked:

```
proposal -> done
specs    -> done
design   -> ready
tasks    -> done
```

`ready` means "could be produced", not "is missing something". So the
chain starts at `propose` and re-proposes work that is already done —
spending a run, and pointing an agent at a `proposal.md` that is finished.

This is not a rare shape. Three of the active changes here have no
design, and so do many archived ones; `openspec validate --strict`
accepts them, which is the tool saying the artifact is optional.

## Capabilities

### Modified

- A resumed chain treats a missing design as a change that needs no
  design, not as a proposal that was never written.

## Out of scope

Deciding when a change should have a design. That is the validator's
question and the author's judgement, and neither is the resume logic's
business.
