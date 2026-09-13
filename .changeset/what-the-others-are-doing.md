---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
---

The Pipeline tab shows every working directory of the repository, not only the one it was pointed at.

Two agents working at once, one in the primary checkout and one in a working directory beside it, used to leave the tab showing only its own queue — and a checkout sitting on a merged branch reported "no active changes" with nothing on screen naming the branch it had read. The tab now names the branch its reading came from, says what this directory's runs report doing, and shows every other working directory beneath in a recessed section of its own: its label, branch and path, its changes with their task counts laid out against its own queue, who holds it and whether that is a different git author, and what its runs say they are doing and how long ago. A directory where no run reports is said to be one, never called idle. A change present in two directories is called out on both. Other directories' changes carry no action and no line is drawn between directories. Core gains `surveyWorktrees`, which runs one `git worktree list` and reads everything else from the filesystem; the server carries it at `/api/worktree-survey`.
