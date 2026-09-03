---
"openspec-ui-vscode": patch
---

Deliver a cancellation to the runner that owns the run.

- The VS Code panel remembers which agent each run was started against, so a cancel no longer falls back to the default agent — cancelling any agent other than `claude-cli` had never reached the run.
- A cancel no longer registers a `WorkbenchProcess`. It is a signal about a run, not a run, and the entry it created waited forever for a terminal event a cancel does not emit.
- The chain path posts `cancelling` when it accepts a cancel, instead of returning silently.
