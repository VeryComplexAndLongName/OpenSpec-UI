---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

A Pipeline card says what its change is doing. Core derives one card per change from readings the hosts already take (`describeChangeCards`, `describeChangeCard`), with facts from the change's own worktree where it has one. Each card gives:

- its state: waiting, running, failed or stopped at a stage, blocked, done or ready;
- the task a live run is on, in the agent's own words, the task it was given, or a marked guess;
- what the run is doing or waiting on, and how long ago it said so;
- how many tasks are done, and how many only a person can close or are delegated;
- how the last run ended, what it cost where that was reported, and why a stopped run stopped.

Its word is `describeChangeState`'s, read against the same standings as the Changes list, so the two never disagree. Runs a card shows are no longer repeated in the run lines above the picture.

A chain now writes one audit entry as it ends, saying how, at which stage and why, and every counter of runs skips it. `readLastRuns` reads each change's last ended run from every worktree's audit log, and parses a log again only when it changes. The server answers `/api/change-last-runs`, and the editor's Pipeline panel answers `pipeline/last-runs` and `pipeline/standings`.
