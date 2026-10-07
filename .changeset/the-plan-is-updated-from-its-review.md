---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": minor
---

The plan is updated from its review (the-plan-is-updated-from-its-review, ADR 0041). A new command, `update`, revises a change's existing planning artifacts so they answer its last completed review and the operator's notes, keeps them coherent, validates the change strictly and changes no code. A review now ends with `Review verdict: ready` or `Review verdict: changes needed`; in a chain, `changes needed` runs one update on the review's agent before apply. The AI panel offers `update` with a notes field, a card whose last review asked for changes offers **Update the plan**, and the CLI has `openspec-ui-cli update <change> [--note <text>] [--agent <id>]`. An update from the terminal asks there for each permission its agent requests, and denies it where nobody can be asked. A review whose agent printed its findings without reporting a result now keeps them in the audit log, so the update can read them.
