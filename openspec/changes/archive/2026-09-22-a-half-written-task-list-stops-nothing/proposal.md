## Why

On 2026-09-22 `stop-boundary.test.ts` failed on CI, on the pull request
for `a-change-keeps-its-history`. It had failed twice on this machine the
same day, under load. Every time it was the same test: a run told to stop
after 2.2 read 2.2 as missing (`absent`) instead of ticked.

The cause is in the product, not the test. `tasks.md` is rewritten by
truncating it and writing it again: by an agent, by an editor, and by the
test. A reading that lands in between sees some of the list, or none of
it. Two things read the list that way while a run works:

- `readTaskTickState` then finds a task that is there to be missing. A
  run told to stop after it gets a wrong answer.
- `countTickedTasks` then counts too few. The next full reading looks like
  a new tick, which is a sound point to stop at, and so a stop can land
  where no task was finished.

## What Changes

- **`readSettledTaskList`.** It reads `tasks.md` again, 50 ms apart,
  until two readings agree, up to six readings. A list with no item at
  all reads as unreadable. Nobody means a list with no item, and reading
  it as "no such task" is how the wrong answer came.
- `readTaskTickState` and `countTickedTasks` read through it. A task is
  then `absent` only where a settled list does not have it.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `execution-core` - where a run asked to stop may end.

## Impact

- `packages/core/src/stop-boundary.ts` and its test.
- A changeset: core, patch.
