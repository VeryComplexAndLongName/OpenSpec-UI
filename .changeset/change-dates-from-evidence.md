---
"@openspec-ui/core": minor
---

Date a change by evidence, and say where each date came from.

A change now carries four dates — proposed, first worked on, last worked
on, archived — each with the source it was read from: a commit, a blame
line, the audit log, the folder name, or nothing at all. Without the
source a chart cannot tell a measured date from an inferred one, and
they plot identically.

The archiving date comes from the commit that put the change under
`archive/`. The `YYYY-MM-DD-` folder prefix is the fallback, used only
where there is no commit to read, and it says so when it is used. Over
this repository's 178 archived changes it answered nothing.

Two defects fixed on the way:

- `getFileCreatedDate` combined `--follow` with `--reverse`, and git
  prints nothing at all for that pair. It returned `null` for every file
  that had ever been renamed — every archived change, silently, as
  "undeterminable".
- `getChangeTimelines` ran every change at once and died with `EMFILE:
  too many open files` on a 185-change repository. It reads in batches
  now, and reads the whole archive's dates in one git call instead of one
  per change (0.5s against 80s).
