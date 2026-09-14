---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
"@openspec-ui/server": patch
"@openspec-ui/cli": patch
---

A change says where it stands. Core reads each change across this checkout, every working directory, `main`, the change's own branch and, where `gh` can read it, its pull request (`readChangeStandings`). It also says how fresh each of those sources is. `describeChangeState` gives the one word every surface shows: Running, Waiting, Archived on main, Merged in #N, Deleted on main, Further along, Failed or Stopped at a stage, Done, Blocked, or Ready. The lines beneath the word name their sources, and a colour agrees with the word.

Where the word shows:

- The VS Code Changes tree and the standalone Changes list show it, and `openspec-ui-cli ready` prints it.
- The run dialog in both hosts leads with it, and asks before starting a change that is running, settled on `main` or merged.
- The Changes list and the Pipeline gain a Refresh that fetches refs now.

A delegated run now records its request and its reply in the audit log, and the waiting-on inbox shows the latest reply beneath its item. The delegated prompt asks the agent to answer within its turn.
