---
"@openspec-ui/core": minor
---

A chain can archive a change in any repository, not only in one whose rules say to tick tasks.

A chain archives only a change whose every task is ticked, and until now nothing in the product told any stage to tick: the implementing agent was asked to implement the tasks, and the verifying agent only to uncheck what does not hold. Repositories whose `openspec/config.yaml` happened to carry a ticking rule worked; one made with `openspec init` stopped at archive with every task done and none ticked. The implementing agent is now told to tick each task as soon as its own verification passes. The verifying agent ticks what it confirmed itself as well as unticking what does not hold, checks an effect that is not a file — a command that must pass — rather than holding it against the task, and never ticks a human-only or delegated task. An implementing run that changed files and ticked nothing is named on the chain's timeline, and an archive refused for unticked tasks names them.
