---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

Running one stage speaks OpenSpec. The stage picker lists `propose`,
`review`, `apply` and `verify` instead of `plan`, `implement` and
`review`, and opens on the stage the run dialog says the run begins at: it
opened on implement whatever the change was, so a change with no proposal
was offered an implementation. Propose now writes the change's proposal,
spec deltas, design and task list where they are missing, from what the
change's directory already holds, and validates them; it used to ask for
"an implementation plan, without changing code" and wrote nothing.
"Implement with the VS Code agent" is now "Apply in VS Code Chat", and
says that the model is the one chosen in that chat and that none of the
configured agents runs.
