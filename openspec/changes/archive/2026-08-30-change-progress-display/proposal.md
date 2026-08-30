## Why

`ChangesList.tsx` shows only a raw `{completedTasks}/{totalTasks}`
fraction for active changes, with no percentage — a user scanning a long
list has to do the division mentally to gauge how close a change is to
done. `ArchiveList.tsx` doesn't show task progress at all, even though
every archived `ChangeSummary` has carried real `completedTasks`/
`totalTasks` since the previous quick win wired real archived-change
data into `/api/overview`; the data is already there, just not
rendered. Separately, `ChangesList.tsx` doesn't render `lastModified` at
all, even though `ArchiveList.tsx` already does and the field already
flows through for active changes — an inconsistency between the two
lists with no reason behind it. (The backlog's third ask in this same
item, per-change spec count, was confirmed already covered by the
existing workspace-wide "Specs: N" counter in the Overview tab's meta
line — no work needed there.)

## What Changes

- New shared helper `packages/webui/src/components/task-progress.ts`:
  `taskCompletionPercent`/`formatTaskProgress`, the single place both
  list components compute/format a percentage, so the two never drift.
  Returns no percentage (plain fraction only) for a change with zero
  total tasks — that's a different state than "0% done," not the same
  thing.
- `ChangesList.tsx`: renders the formatted percentage next to the
  existing fraction; also renders `lastModified` (mirroring
  `ArchiveList.tsx`'s existing `<time>` element), which it did not
  render before at all.
- `ArchiveList.tsx`: renders task progress (fraction + percentage) for
  the first time — previously showed only name and last-modified date.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `shared-ui`: `ChangesList` and `ArchiveList` both now show a
  task-completion percentage alongside the existing fraction, and both
  now show `lastModified` (previously `ChangesList` did not, and
  `ArchiveList` did not show task progress at all).

## Impact

- `packages/webui/src/components/task-progress.ts` (new),
  `task-progress.test.ts` (new).
- `packages/webui/src/components/ChangesList.tsx`,
  `packages/webui/src/components/ArchiveList.tsx`, and their test files.
- No change to `packages/core`, `packages/server`, or the command/event
  protocol — this is a pure display change over data already present on
  `ChangeSummary`.
