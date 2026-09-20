---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

The Changes view says whose each change is

A working directory is cut from the default branch, so it holds every
change that was active there rather than one. Each row now says where its
change is worked: this directory's own change comes first and is named
beside the view's title, a change worked in another working directory is
locked and greyed with the directory and the person in its description,
and a change nobody has taken up is left as it was.

The menu items that would write are not offered on another directory's
row, and each of those commands refuses when it is reached another way,
naming the directory to work in instead. Reading one is offered instead:
that directory's own copy of a change opens read-only, edits and all, and
a picker lists every active change with where it is worked.
