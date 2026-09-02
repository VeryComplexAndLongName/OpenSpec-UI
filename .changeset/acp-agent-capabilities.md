---
"@openspec-ui/core": minor
---

Add `copilot-cli-acp` and `claude-cli-acp` rows to `HARNESS_AGENT_CAPABILITIES`,
matching their plain counterparts' reasoning-effort and spending-cap
mechanisms exactly (each ACP adapter spawns the same binary with the same
flags, already permitted by the same allowlist entries). Add explicit empty
rows for `codex-cli-acp` and `gemini-cli-acp`, whose adapters deliberately
render neither flag — an absent row is what let this drift silently before.

`{ "agent": "copilot-cli-acp", "budget": { "maxAiCredits": 100 } }` and the
equivalent `effort` setting now resolve instead of being refused; the unit
and floor checks (`maxCostUsd` rejected for `copilot-cli-acp`, `maxAiCredits`
rejected for `claude-cli-acp`, Copilot's 30-credit minimum) are unchanged.
