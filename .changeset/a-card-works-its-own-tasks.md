---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"@openspec-ui/cli": minor
"openspec-ui-vscode": minor
---

A Pipeline card works its change's tasks in the worktree made for it. A
task's hint now holds all of it, and selecting a task opens it whole beside
the board. For a change in its own worktree, a card closes or reopens a
task with a note written under it (required for a Human-only or delegated
task), commits that `tasks.md` alone and pushes the branch, and runs a
delegated task on its agent. Refused while a run works there. The change's
name opens its task list where it is worked: `tasks.md` from the worktree
in the editor, which looked only in this checkout and so opened nothing for
a change not yet merged; a page of its own in a new browser tab in the
standalone app. An open card can hide its done tasks. From a terminal:
`openspec-ui-cli task done|reopen <change> <number> [--note]` and
`openspec-ui-cli task commit <change>`. Cards read from anywhere else stay
read-only (ADR 0026, amended).
