---
"@openspec-ui/core": minor
---

A stage may name a custom agent — a preset you defined yourself — and it
reaches the CLI as `--agent <name>`. Accepted for the `claude-cli` and
`copilot-cli` families, raw and ACP alike; setting one for an agent whose
CLI takes none is rejected rather than silently dropped.

`findCustomAgents` discovers them from the directories the CLIs
themselves read: `.claude/agents/*.md` in the project and for the user,
and `.github/agents/*.md` for Copilot. A name defined in both is offered
once, with the project's winning.
