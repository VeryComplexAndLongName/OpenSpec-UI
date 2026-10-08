---
"@openspec-ui/core": minor
---

An apply that did nothing ends the chain (an-apply-that-ticks-nothing-ends-the-chain). When the implementing stage completes having changed no file and ticked no task, while a task it could do (not Human-only, not delegated) is still open, the chain ends as failed, saying so and naming the open tasks, instead of going on to verify, which has nothing to confirm, and to archive, which refuses. An apply that changed files and ticked nothing is still only named, and the chain goes on, as before.
