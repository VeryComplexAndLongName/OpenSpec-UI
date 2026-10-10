---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
"@openspec-ui/server": minor
---

**A change is on the server from the moment it is made** (a-change-is-committed-where-it-is-made, ADR 0043 amended). Create Change, in both hosts, now commits the new change on its own branch and pushes it, and says so - or says why the server refused it. The rules written into `CLAUDE.md` and `AGENTS.md` tell every agent *when* to commit, not only where: the planning artifacts on the change's branch with `git push -u origin <change-id>` as soon as they are written, the work of every task ticked, nothing left unpushed at the end of a turn, nothing of a change on `main`; run **Write Agent Workflow Rules** to give an existing repository the new rules. The `git` stage commits what the stages left before it pushes. A card whose change's branch is not on the server says "not on the server", and a new action, **Commit Change**, on the card and in Show Actions..., commits everything the change's worktree holds and pushes it. A card of a change's own worktree now offers its actions in the Pipeline's arrangement by step as well, not only on the board by stage, and **Run Change...**, which runs the change in its worktree - before, such a change could be acted on but never run from its card. New messages `OSW-GIT-001`..`OSW-GIT-203`.
