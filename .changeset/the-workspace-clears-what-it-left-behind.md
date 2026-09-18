---
"@openspec-ui/core": minor
"@openspec-ui/server": minor
"@openspec-ui/webui": minor
"openspec-ui-vscode": minor
---

The workspace clears what it left behind

Asked for by the owner after the product listed two archived changes as
"No tasks": allow for a directory left behind, remove it at startup, and
sweep for it on an interval - and look at the working directories, where a
lot gets stuck.

A directory under `openspec/changes/` carrying none of `proposal.md`,
`design.md`, `tasks.md` or `specs/` is not a change, and no longer appears
as one in either host. The product clears the ones it left itself: a
directory whose change is already archived and whose every file is one
this product writes. Everything else is shown rather than removed - a
directory holding `.openspec.yaml` alone is somebody starting a change by
hand, and one whose name is nowhere in the archive may be a change nobody
has written yet. The sweep runs where a workspace is read, on activation
and on one interval both hosts take from core.

Working directories are read the same way: the survey now says of each
whether it is finished with - its branch merged into the default branch or
gone from everywhere, its tree clean, no run recorded against it. Nothing
is removed without a press, and the press deletes every junction as a
junction before the directory, since a recursive delete through a
worktree's `node_modules` takes the primary tree's packages with it.

The Summary gains a "Left behind" panel: what was cleared, what will not be
cleared with what it holds, and the working directories with nothing left
to do. The editor's Changes view says the same above its changes, and
offers the removal on the row.
