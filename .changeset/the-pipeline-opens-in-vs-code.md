---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
"@openspec-ui/server": patch
---

The Pipeline opens in VS Code.

**OpenSpec UI: Open Pipeline**, also in the Changes view's title bar, opens the same Pipeline picture the standalone shell draws, in a panel of its own: this directory's changes, what can start alongside what, and every other working directory with what its runs say. Choosing a change's card reveals it in the Changes tree and opens its `proposal.md`.

The panel does not poll. While it is visible, the editor watches `openspec/changes` and the directory the runs' status records are written to, and tells the picture which reading is out of date; events within a second become one message, and a reading every minute covers what raises no file event. A status record changing re-reads the records alone, without running git. The ages a run's line states keep counting between readings.

- Core gains `readPipelineReadiness`, the readiness report with its suggestions, which the standalone server's route now calls instead of assembling the payload itself; `refreshSurveyRuns` and `attachRunsToDirectories`, which lay freshly read status records over a survey; and `activityAt`/`heartbeatAt` on a status report and a surveyed run. `describeRun` and `describeDirectoryRuns` take an optional clock.
- `PipelineView` takes an optional `subscribe`: a host that knows when a reading is out of date says so, and the view reads on its word and on a one-minute backstop. Without it the view polls as before.
