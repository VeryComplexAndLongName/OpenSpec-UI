---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": minor
---

The supervisor can act on a failed stage (the-supervisor-changes-agents, ADR 0039 decision 4). Under `supervisor.mode: "act"`, set in a change's own `harness.json` together with `autonomyLevel: "autonomous"` and more than one attempt per stage, a stage whose failure is likely to pass is attempted again on the same agent, and one that repeating cannot fix is moved to the first agent of `supervisor.fallback.<stage>` the change's policy allows: `allowProviderChange` for another provider, `allowCostIncrease` for any agent but the local model. Every repeat and move is said in the chain's events, recorded in the audit log, and costs an attempt; a chain says `failed` only for a stage it does not try again. Every registered agent now names its provider. Under `advise`, the last-run suggestion names the fallback `act` would use. A change's Harness Settings offers Act under Autonomous, with the fallback per stage, the allowances and a note on cost and providers; `openspec-ui-cli run` prints why a stage is attempted again.
