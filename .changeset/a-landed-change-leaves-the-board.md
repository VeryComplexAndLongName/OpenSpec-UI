---
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

A change the default branch has archived no longer hangs on the board.
A worktree branched before the archive still held the change as it was,
and the board drew it In progress. It now stands in Archived, and a copy
left in another worktree draws no card of its own.
