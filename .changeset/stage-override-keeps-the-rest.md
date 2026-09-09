---
"@openspec-ui/core": patch
---

A per-change stage entry now overrides the fields it names and inherits
the rest from `agent-harness.json`. It used to replace the stage's entry
outright, so a change setting only an effort for `apply` silently
discarded the model the global file set for that stage — and every named
configuration did exactly that.

Naming a different agent for a stage still inherits nothing: a stage's
model, effort and budget belong to its agent, whose effort vocabulary and
budget unit differ from another's.
