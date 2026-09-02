---
"@openspec-ui/webui": minor
"openspec-ui-vscode": patch
---

A run started from the AI panel can now be cancelled from it: a Cancel button next to Run appears while a run is in flight, sending a `cancel` command on the active `runId` through the same transport the run was started on — the only cancel affordance previously existed for `HarnessChainPanel`'s chain runs, unreachable at `autonomyLevel: "assisted"`, so a single-stage run (available at every autonomy level) could not be cancelled from the UI at all. `openspec-ui.cancelProcess`'s contributed title is renamed to "OpenSpec UI: Cancel Implementation Session" to say what it actually cancels — an implementation session via `deps.implementationSessions.cancel(...)`, not a harness run; its command id, `when` clause, and behavior are unchanged.
