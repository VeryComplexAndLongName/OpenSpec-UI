---
"@openspec-ui/core": patch
"@openspec-ui/webui": patch
"@openspec-ui/server": patch
"openspec-ui-vscode": patch
---

The Pipeline's board now looks like a board. A rule stands between each
column and the next, and every heading carries the stage's word, a picture
that stands for it, how many changes are in that column, and a colour of
that stage's own.

The colour never carries a distinction by itself: the word is always
there, and the picture agrees with it. Its value comes from a palette
token defined for the light theme, the dark theme and the editor alike -
and in the editor from the editor's own chart colours, so a theme that
repaints its charts repaints these with them.

The count is shown as a figure and said in full for a reader who hears the
heading rather than seeing it.

The arrangement by declared order is untouched: its columns are a
sequence, not six named places, and a rule there would assert a boundary
nothing has.
