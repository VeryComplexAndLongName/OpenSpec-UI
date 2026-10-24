---
"@openspec-ui/core": patch
---

**An ACP agent is heard on stderr** (an-acp-agent-is-heard-on-stderr). The ACP session driver - shared by `claude-cli-acp`, `copilot-cli-acp`, `deepseek-cli-acp`, `codex-cli-acp` and `local-llm-acp` - spawned each agent with stderr piped and never read it, so an agent writing its logs there could stall mid-run once the pipe filled, and a run that failed said only that the connection closed. stderr is now read from the moment the agent starts, handed on as `stderr` events as the raw-text adapters do, and the last of it (up to 4000 characters) ends a failed run's reason - "not signed in", a crash, whatever the agent said.
