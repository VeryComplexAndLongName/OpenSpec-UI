---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
"@openspec-ui/webui": patch
---

A run says which task it is on, and when it is waiting.

The implementing instruction now asks the agent to print a line of its own, `Starting task <number>`, before it starts a task. A run's status record reads that line and keeps the task, and a run waiting at a checkpoint or on a permission says so instead of looking like it is still running.

- Core: `readTaskMarker` reads a marker line — plain, in bold or backticks, after a quote, list or heading mark, with a title after a colon — and nothing in running prose. `taskInHand` pairs a recorded number with the change's own task list and names no task for a number the list does not have.
- The status record gains `runId`, `task` (`{ number, source: "agent" | "command", since }`) and `waiting` (a checkpoint with its stages, or a permission with its description). A marker is read from stdout and from the agent's reply, never from its reasoning or a tool call's title; every completed line of a chunk is read, so a message that arrives whole keeps its marker. The task and the wait are written at once, outside the once-a-second limit on streamed activity. A run started for one task (`taskNumber`) keeps that task whatever a marker says. A record written before these fields reads with all three `null`.
- The survey's runs carry `runId`, `waiting` and the task in hand, and `describeRun` says `on task 1.2: <text>, by its own account` or `the task it was given`, and `waiting to continue to <stage>` or `waiting for a permission: <description>` in place of the stage.
- `openspec-ui-cli status` prints the same task and wait lines, and its `--json` carries the three fields as the record holds them.
