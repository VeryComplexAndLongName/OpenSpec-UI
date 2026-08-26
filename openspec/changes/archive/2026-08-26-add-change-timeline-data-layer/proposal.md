## Why

The user asked for a visual "change timeline": for one OpenSpec change,
a vertical list of its tasks positioned by completion date; later, a
global view comparing several changes in parallel lanes on a shared
logarithmic time axis. No source of "when was this task completed"
exists anywhere today — `tasks.md` checkboxes carry no timestamp. This
change is the shared data layer both the single-change view
(`add-change-timeline-view`, next) and the multi-change view
(`add-multi-change-timeline-view`, after that) will consume unchanged,
per the user's explicit request to design both phases' data needs
together up front. No UI ships in this change.

## What Changes

- Add `packages/core/src/change-timeline.ts` (Node-only — exported only
  from `index.ts`, never `browser.ts`, since it uses `simple-git`):
  - `blameLineDates(cwd, relativeFilePath)`: `git blame --line-porcelain`
    via `simpleGit(cwd).raw([...])` (the same ad-hoc-raw-command pattern
    `checkpoint.ts`'s `gitCheckpointPaths` already uses), parsed into a
    `finalLineNumber -> ISO date` map. Never throws — returns `undefined`
    on any git failure (shallow clone, uncommitted file), so a task
    simply has no date rather than the whole read failing.
  - `getChangeCreatedDate` (git log, first commit adding proposal.md)
    and `getChangeArchivedDate` (regex on the `YYYY-MM-DD-<name>`
    archive folder name — no git call, and 100% reliable regardless of
    squash-merge history, since this repository's own archive folders
    already carry this prefix).
  - `getChangeTimeline(workspaceRoot, changeName, archived)` and a batch
    `getChangeTimelines(workspaceRoot, entries)`, merging
    `readTaskChecklist`'s existing parse with blame-derived dates, plus
    the four artifact markdown strings (proposal/design/tasks/spec).
- Add REST routes `POST /api/change-timeline` and
  `POST /api/change-timelines` in `packages/server` (`rest.ts`/
  `server.ts`), following the existing literal-`if`-routed handler
  pattern (no router library) already used for `/api/change-editor/*`.
- Add `packages/webui/src/change-timeline-client.ts`, mirroring
  `change-editor-client.ts`'s injected-`fetch`-function shape exactly.

## Capabilities

### Modified Capabilities

- `execution-core`: adds a Requirement for best-effort, git-derived
  change/task timestamps — "OpenSpec/git state parsing" per this
  capability's existing Purpose statement, alongside `change-state.ts`'s
  existing lifecycle-state derivation.

## Impact

- `packages/core/src/change-timeline.ts` (new)
- `packages/core/src/index.ts`
- `packages/server/src/rest.ts`, `packages/server/src/server.ts`
- `packages/webui/src/change-timeline-client.ts` (new)
- `.changeset/*.md` (new changeset file)
