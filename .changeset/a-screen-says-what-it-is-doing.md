---
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": patch
---

The standalone shell says what it is doing. Diff Preview shows the real diff
of a change you choose, from a new token-gated `POST /api/change-diff`,
instead of the two-line sample it has always shown; a change with nothing
uncommitted says so, and a workspace that is not a repository says that. A
tab that reads when it opens now shows one status line naming what it is
reading, so a slow screen no longer looks like a broken one. The theme
control is a switch: its visible name stays "Dark theme", and its state is
carried by the switch's role and an icon.
