---
"@openspec-ui/core": patch
---

`local-llm-acp` now starts `coding-agent` the way it reads its command
line, `coding-agent --base-url <url> --model <name> [limits] acp`: with
the subcommand first, as before, `coding-agent` printed its usage and
exited, and no run could start. The allowlist admits that order and no
other. With `coding-agent` 0.3.0, which speaks the Agent Client Protocol,
a run streams the agent's text, its tool calls and its tokens.
