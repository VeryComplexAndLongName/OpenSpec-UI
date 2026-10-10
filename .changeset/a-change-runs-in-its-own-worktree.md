---
"@openspec-ui/core": minor
"openspec-ui-vscode": patch
"@openspec-ui/server": patch
---

**A change in its own worktree runs there** (a-change-runs-in-its-own-worktree). Run Change... on the card of a change worked in its own worktree failed at its first stage with `cwd "…/.worktrees/<repo>/<change>" is outside the workspace`: every agent was bound to the workspace that was open. A run inside one of the repository's worktrees is now given that worktree's own agents, whose sandbox is that worktree - for a chain, a single stage and a card's controls of a run, in the editor and in the standalone app; a directory that is neither the workspace nor one of its worktrees is still refused. The editor's run dialog also applies a named configuration to the worktree's copy of the change's harness, not the checkout's.
