---
"@openspec-ui/core": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

The sweep no longer leaves half-removed working directories

When git could not delete part of a finished working directory, for
example a path too long for it on Windows, the sweep said so and left the
rest behind, where nothing looked at it again. It now removes what git
left and has git forget the worktree. The pass that archives landed
changes also refuses to push a branch that archives nothing.
