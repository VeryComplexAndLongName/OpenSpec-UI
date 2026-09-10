---
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
"openspec-ui-vscode": patch
---

A stage override keeps its custom agent, and one function decides what
applying a named configuration writes.

`mergeStepAgent` merged three named fields across a per-change override.
`customAgent` was the fourth field a stage entry may carry, so a change
naming the same agent plus a custom agent resolved without it and the
chain ran with no `--agent` flag, silently. The merge now iterates
`STEP_AGENT_KEYS` — the list the validator already reads — so the next
field added to an entry arrives already merged, and it agrees with
`templateConfigToWrite`, which kept the field by spread.

Applying a named configuration to a change now goes through one core
function, `changeTemplateConfigToWrite`, from all three surfaces. The
run dialog resolved a configuration's effort against the change's
resolved configuration and the settings view against the change's own
override, where every stage the change does not name reads as
"inherit" — so the two wrote different files for the same change, and
the settings view's message said "None of the agents on screen takes an
effort setting" when that was not the reason. That message now names the
stages given an effort, the agents that take none, and the stages with
no agent chosen, each only where it is true.

The balanced and careful configurations describe their effort by its
position in the agent's range ("a third of the way up", "two thirds")
rather than as "the middle", which the thirds mapping never produced:
for `copilot-cli` the medium level resolves to `low`, the third of
seven. `HARNESS.md` carries the resolved value per registered agent.
