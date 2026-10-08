---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": minor
---

The agent asks the operator, and nothing goes on without an answer (the-agent-asks-the-operator, ADR 0042). Agent stages are told to print `Question for the operator: <question>` for each decision the change's files leave open, and `local-llm-acp` can ask mid-turn with its `ask_operator` tool. Each question is kept in the change's `decisions.md` and the audit log. A run that asked waits instead of completing, under every autonomy level, and once every question is answered it runs the stage again with the answers (`update` after `propose` or `review`). Agent runs on a change with an open question are refused, naming it. Questions are answered on the change's card, in the AI and chain panels, in the Human-Only Inbox, with `openspec-ui-cli answer`, or in `decisions.md` itself; `openspec-ui-cli status` and the supervisor say how to answer a waiting run. The run and chain panels also offer every permission request still pending, each with its own Allow and Deny, rather than only the latest: an agent that runs tool calls side by side asks for several at once. A permission request the agent withdraws, or leaves open when its turn ends, is said with a new `permissionWithdrawn` event and leaves the panels, as do the requests of a stage that has ended.
