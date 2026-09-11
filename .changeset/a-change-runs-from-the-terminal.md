---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

A change runs from the terminal.

`openspec-ui-cli run <change>` runs one change through the same harness
chain the two interactive hosts use, with the same allowlist, sandbox,
audit log and workspace lease. `openspec-ui-cli check <change>` runs the
mechanical checks that change's `tasks.md` declares, invoking no agent.

The terminal is a thinner surface, not a more privileged one: the run
does only what the change's own configuration already permits, and there
is no flag that starts a chain for a change configured to run one stage
at a time or that answers a confirmation the change asked for. Every
refusal happens before the first stage, including a stage whose agent
this build has no runner for.

Core gains `resolveChainStart`, `runDeclaredChecks` and
`withWorkspaceLease`, and the workspace lease knows a third kind of host.
