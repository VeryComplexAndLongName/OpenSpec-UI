---
"@openspec-ui/core": minor
"openspec-ui-vscode": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
---

Agents are told how work is done here (agents-are-told-how-work-is-done-here, ADR 0043). Initializing OpenSpec, in either host, now writes a section into CLAUDE.md and AGENTS.md that tells every agent, however it was started, to work each change in a git worktree of its own at ../.worktrees/<repository>/<change-id> on a branch cut from origin/main, and where the stage assignment is; a file somebody else wrote gets it only where you agree. "Write Agent Workflow Rules" adds it to a repository initialized before. "Create OpenSpec Change" now makes the change in its own working directory, and openspec-ui-cli worktree add makes one for a change that does not exist yet. Initializing also offers to commit the OpenSpec setup to main and push it at once, so each change has origin/main to be cut from; an agent that finds it missing commits it itself and goes on.
