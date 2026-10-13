---
"@openspec-ui/core": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
"@openspec-ui/webui": patch
---

Show Logs on a change's card reads the logs of the change's own worktree, where its runs write them, and the card of a change worked in its own worktree offers it. Before, the button read only the host's root and said there were no logs.
