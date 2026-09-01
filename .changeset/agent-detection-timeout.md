---
"@openspec-ui/core": patch
---

Agent presence detection now allows a CLI 10 s to answer a `--version` probe instead of 3 s. On a loaded Windows machine `copilot --version` measured 4.96-6.51 s and `claude --version` 1.61-2.72 s, so an installed, working CLI was annotated as "not detected". A genuinely missing executable still resolves immediately via `cross-spawn`'s `error` event rather than waiting out the budget, and probes still run in parallel, so the worst case grows once, not per agent.
