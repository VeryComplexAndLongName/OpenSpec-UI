---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

Show what a chain run has spent, while it is still running.

A run recorded its usage but nothing displayed it: the figure lived in `.openspec-ui/audit.jsonl` and in one line of the event log. A chain now renders a usage summary beside its event log — a row per stage that has started, with tokens and money, and the configured ceiling beside the recorded total when one is configured.

Attribution needed a new event. A chain publishes every stage under one `runId` and announced a stage only when it *ended*, so the first stage's usage had no stage to belong to, and a chain that stopped mid-stage never named the stage that spent the money. `stageStarted` is emitted immediately before each stage begins — after any check that could refuse it, so a stage stopped at the budget ceiling is never announced as having started. It is non-terminal, like `agentUpdate`/`cancelling`/`usageReported`.

Two kinds of figure are kept apart. The recorded total is what agents reported for finished runs and is what a ceiling is compared against. A live figure — an ACP `usage_update` arriving during a run, previously rendered as `agent update: usage_update` and discarded — is shown as the agent's own running report; its `used` is context occupancy, falls after a compaction, and never enters a token total. Nothing here enforces anything: `HarnessChainRunner.checkBudget` remains the only thing that does.

A stage whose agent reported nothing reads "not reported", never `$0.00`, and a run in which nothing reported says so outright rather than showing an empty panel that looks broken.
