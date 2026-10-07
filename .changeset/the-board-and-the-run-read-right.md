---
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

The board and the run read right (the-board-and-the-run-read-right). A `propose` or `review` run no longer moves a change In progress on the board: only work on the implementation does (`implement` and `verify` runs, a chain's apply, verify and git stages, the verify checks), and each run's audit entry now records its command. In the AI panel the result of a run is shown once, rendered as Markdown, instead of two or three times as plain text; the log reads as text, with the agent's words rendered and tool calls as quiet lines instead of a framed box per message; and the run analysis counts an ACP agent's tool calls.
