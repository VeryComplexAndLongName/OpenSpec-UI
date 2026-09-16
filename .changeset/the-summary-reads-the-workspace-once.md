---
"@openspec-ui/core": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

The OpenSpec view summary opens in about a second instead of minutes. For
every archived change it used to read the whole workspace again, all at once:
on a repository with 250 archived changes that step took 157 seconds, held
several cores and could run out of file handles. It now summarises every
archived change from the one reading the request already made, in about
100 ms there, with the same counts.
