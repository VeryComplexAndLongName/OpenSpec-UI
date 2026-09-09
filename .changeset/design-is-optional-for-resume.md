---
"@openspec-ui/core": patch
---

A change with no design is not an unproposed change.

A resumed chain decided where to start by requiring three artifacts to be
done — proposal, design, tasks. A change that deliberately carries no
`design.md` never satisfied that: the status command reports a missing
artifact as `ready`, meaning "could be produced", and the chain read that
as an unfinished proposal. It restarted at `propose` and re-proposed work
that was already written, spending a run and pointing an agent at a
finished `proposal.md`.

Three of this repository's own active changes have no design, and so do
many archived ones; `openspec validate --strict` accepts them.

The proposing stage now counts as done when the proposal and the task
list are. A change genuinely mid-proposal has no task list yet, which is
the case the check exists for and still catches.
