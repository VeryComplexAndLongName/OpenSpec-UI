---
"@openspec-ui/core": minor
"@openspec-ui/webui": minor
"@openspec-ui/server": minor
"openspec-ui-vscode": patch
---

Compare changes draws every change of the workspace on a grid of days

The Timeline's comparison no longer asks which changes to compare or over
which dates. Choosing it reads the whole workspace in one pass and draws a
bar per change, from the hour it was proposed to the hour it was archived,
with the period chosen from 2 days, 5 days, 2 weeks or All, weekends
shaded, a dashed line at now, a filter for finding a change by name, and a
row that opens that change's own timeline. The charts follow the grid, over
the changes the grid shows.

Core gains `readChangeSpans`, which dates every change of a workspace in
one pass — 1.2 s against the 62 s the per-change read cost on this
repository's 264 changes — and `change-comparison.ts`, which derives the
grid's days, rows and positions. The server gains `POST /api/change-spans`.
The editor's "Show Change Comparison Timeline" opens the same screen over
every change, with no quick pick.
