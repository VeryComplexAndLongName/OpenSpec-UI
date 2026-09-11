---
"@openspec-ui/core": minor
---

A change can declare a step in its own chain.

A per-change `harness.json` may now carry `steps`, each naming an entry
in a closed registry the core owns and stating one position relative to
one fixed stage. The six fixed stages stay fixed, present, and in order:
a declaration inserts, and can never remove, replace, or reorder one.

The registry opens with `await-change`, which waits until a named change
is no longer active in the workspace — the first consumer
`waitForExternalSignal` has had since it was written. Time spent waiting
is not charged against a chain's run-time ceiling, for the same reason
time at a checkpoint is not.

`HarnessStepAgentStage` is now the four stages that run an agent, named,
rather than everything except the two that do not.
