---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

The Pipeline's cards can be sorted. A Sort control beside the arrangement
stacks each column's cards by Name, by Progress (the change furthest along
first), or by Recently changed (the change worked on last first, counting
a task list's last change as well as a run's end, so work done by hand
counts too). The choice is kept with the zoom and the arrangement.

Names are now compared as a person reads them: digits as numbers, case
aside. A numbered change stands in its place, "change-2" before
"change-10", where before the column put "change-10" first.
