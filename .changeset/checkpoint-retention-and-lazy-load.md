---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
---

Bound retained checkpoints on their own limit and stop reading every one at startup.

- `WorkbenchRunJournal.load()` returns checkpoint references with a `loadCheckpoint()` reader instead of reading and parsing every payload. On this repository that read was 531 MB on every activation.
- New `maxCheckpointSessions` (default 10), separate from `maxProcesses`: a process entry is tens of bytes, a checkpoint tens of megabytes, and one limit over both is not a limit.
- Retention is by recency, never by process state — `canRollback` covers completed and failed runs, so evicting them by state would withdraw a rollback the product offers.
