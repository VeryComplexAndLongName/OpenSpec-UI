---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": minor
---

The board's Archived column now holds what was archived. It could not
before, and not by accident: archiving moves a change out of
`openspec/changes`, which is where the board draws from, so the last
column was empty by construction and nothing could ever appear in it.

It draws the changes archived most recently, each saying the day it was
archived and offering no action, and counts the rest in one line beneath
the board. What is drawn is bounded twice, by a window of days and by a
count: a week of this repository is 75 archived changes, which is a wall
rather than a column, and a count alone would show a quiet repository
changes archived months ago.

The archive is read from the default branch on the server, so every
machine that has fetched sees the same one - a working directory's own
copy is as stale as that directory. Where that branch cannot be read, this
directory's archive is read instead and the line beneath the board says
so.

The day comes from the archived directory's own name. No commit, no blame,
no forge: one listing of one tree answers the whole question.
