---
"@openspec-ui/core": minor
"@openspec-ui/cli": minor
---

Every change has a stage, and you can see how long it spent in each

Each change now has a stage: Proposed, Planned, In progress, In review,
Landed or Archived. Nobody sets it. The stage comes from what has already
happened: commits, ticked tasks, runs, the pull request being opened and
merged, and the archive. When a change is sent back, it returns to the
stage it was sent to and moves forward again from there, so a change can
pass through a stage more than once.

`openspec-ui-cli stages` lists where every change is, for how long, and
who owns and implements it. `openspec-ui-cli stages <change>` shows each
time the change entered a stage and the total time it spent in each.
Pull request times are read from GitHub, GitLab or Gitea.
