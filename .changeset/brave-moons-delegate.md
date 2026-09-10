---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
"@openspec-ui/webui": minor
---

A task that needs a live check can name the agent that performs it.
`**Delegated to <agent-id>**` sits beside `**Human-only**`: the first
means another agent can make the check, the second that none can. The
inbox in both hosts now carries both kinds and says who each item waits
on, naming an agent id the registry does not carry rather than treating
it as assigned.
