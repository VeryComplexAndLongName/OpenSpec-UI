---
"@openspec-ui/core": minor
---

**Codex over ACP is a full agent** (codex-cli-acp-is-a-full-agent, ADR 0052). `codex-cli-acp` now runs a stage in a named sandbox - `workspace-write` for plan, implement, update and verify, `read-only` otherwise, as `codex-cli` does - and with the stage's model and effort (`low` to `max`), all set as ACP session options through `session/set_config_option` before the prompt. Every option is checked first against what the agent's session lists; a model or effort it does not offer fails the run in words before anything is set (`OSW-AGT-223`, `OSW-AGT-224`). It reports tokens and a context gauge. Separately, the ACP driver now reads cached input under ACP's own field names (`cachedReadTokens`, `cachedWriteTokens`), so an ACP agent's cached tokens are recorded at all. The bridge is `npm install -g @agentclientprotocol/codex-acp`.
