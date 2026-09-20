---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

The Pipeline says how far this checkout is behind what has landed - "main is
5 commits behind origin/main; 2 of these changes are archived on main" - and
offers to catch up. Catching up is a fast-forward and nothing else: it
refuses a tree that is not clean, a branch with commits the remote does not
have, and a checkout that is not on its default branch, each by name. A card
of a change in another working directory now says when that change is
archived on main.
