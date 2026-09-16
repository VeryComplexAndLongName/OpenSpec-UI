## Why

On 2026-09-16 the owner reported that the standalone shell's OpenSpec view
summary shows nothing for a minute or more, and the live server was found
holding about three cores with `EMFILE: too many open files` in the Processes
tab.

The cause is in `packages/server/src/rest.ts`'s overview handler. It reads the
workspace once with `discoverOpenSpecWorkspace`. Then, for every archived
change at once, it calls `getArchivedChangeSummary(cwd, name)`, and that
function reads the whole workspace again to find the one change it was named.

- **The cost is quadratic.** This repository has 250 archived changes and
  1,005 artifacts. One read takes 768 ms, and the summary step runs 250 of
  those reads side by side.
- **Measured on 2026-09-16, on this repository:** the summary step took
  156,919 ms, after the first read's 768 ms. Every summary was correct; the
  work was simply done 250 times.
- **It grows with every archived change,** and each read got heavier when
  `a-schema-artifact-stays-inside-its-change` added a real-path check per
  artifact.

## What Changes

- **Core gains `getArchivedChangeSummaries(workspace)`.** It summarises every
  archived change of a workspace that has already been read, from that
  reading, with no second discovery.
- **The overview handler passes the workspace it already read** instead of
  asking for each change by name.
- **`getArchivedChangeSummary(root, name)` keeps its signature and result.**
  It reads the workspace once and shares the per-change summary with the new
  function, so the two cannot drift.
- **Not in this change:** what a tab shows while it reads. That is
  `a-screen-says-what-it-is-doing`.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `command-output-hub`: the OpenSpec view summary reads the workspace once
  per request.

## Impact

- `packages/core/src/task-checklist.ts` and its test.
- `packages/server/src/rest.ts`.
- No REST payload, protocol or UI change: the overview returns the same
  `archivedChangeSummaries`.
