---
"@openspec-ui/core": minor
---

Record the resource usage an agent reports, so a configured budget can act on it.

`AgentUsage` / `AuditEntry.usage` / `buildUsageReport` / `checkBudget` were a complete chain with nothing feeding it: no adapter had ever produced a usage figure, so the chain-level ceiling had never once fired. Two adapters now report what their agent said it spent — `claude-cli-acp` from `claude`'s own terminal `result` line, and the ACP session driver from `PromptResponse.usage` and `usage_update` notifications — and the runner writes it into the run's terminal audit entry.

A run whose agent reported nothing records no `usage` field at all, never a zero: absent means unreported, and a ceiling compared against an absent figure still permits the work. An ACP `usage_update`'s `used` is context occupancy rather than consumption and is deliberately not recorded; a non-USD cost is kept in its own currency rather than converted. `LIMITS.md` now says which agents report usage and which do not.
