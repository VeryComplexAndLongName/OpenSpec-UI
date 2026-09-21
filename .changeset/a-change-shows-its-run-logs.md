---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": minor
---

Every run keeps a log, and a change's card opens it

A run's output used to vanish when the run ended. Now every run writes
what it said to `.openspec-ui/runs/`: output and errors, the agent's
replies and reasoning, tool calls, stages, stops, and how it ended,
including a run that was refused and why. Each log is capped at 5 MB and
the newest 200 are kept.

Each card in the Pipeline, in the standalone app and in the editor's
panel, has a Logs button. It lists the change's runs, newest first, and
shows each one's log.
