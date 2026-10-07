---
"@openspec-ui/core": minor
"openspec-ui-vscode": patch
---

What landed is archived without waiting (landed-changes-are-archived-without-waiting). The extension now starts in any workspace with an OpenSpec project, not only once its view is opened, so the sweep that archives landed changes runs there. A host sweeps again within minutes, not at its half hour, after an archive merges, after a new failure, and while a change's own branch is on the server, so a merge is followed by its archive within minutes. A refused push says git's reason, and a fetch that failed says the archive waits.
