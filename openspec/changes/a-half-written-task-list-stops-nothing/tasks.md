Found on 2026-09-22: `stop-boundary.test.ts` failed on CI for pull
request #708, and twice on this machine the same day, each time reading
a ticked 2.2 as `absent`.

## 1. The fix

- [x] 1.1 `readSettledTaskList` in `stop-boundary.ts`:
  - it reads `tasks.md` again, 50 ms apart, until two readings agree, up
    to six readings;
  - a list with no item at all reads as unreadable.
- [x] 1.2 `readTaskTickState` and `countTickedTasks` read through it.

## 2. Checks

- [x] 2.1 Three tests:
  - a list read mid-write is read again until it settles;
  - a list with no item is unreadable;
  - a named task is found in a file truncated and rewritten while it is
    read. Without the fix, that one reads the empty file and answers
    `absent`.

  `stop-boundary.test.ts` passed 3 runs of 3 in a row, 16 of 16 each.
- [ ] 2.2 `npm run typecheck && npm run lint && npm run test` at the root,
  after `git add`, run unpiped, exit code 0.
- [x] 2.3 A changeset: core, patch.
- [ ] 2.4 `openspec validate a-half-written-task-list-stops-nothing
  --strict`, and the merge gate locally with `--base origin/main`.
