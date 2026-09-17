## Why

On 2026-09-17 the pull request run for #549 failed in `quality`, on a test
unrelated to the change: core's `stop-boundary.test.ts`, "ends the run when a
task is ticked, read on the check interval", with `expected +0 to be 1` after
1061 ms. It had passed in every local verify, and passed when the job was run
again.

The test fakes `setInterval`, asks for a stop, ticks the check interval
twice, and waits for the run to end once a task is ticked. The interval's
wake is lost when it fires while the previous tick's read of `tasks.md` is
still on the disk: that read resolves a promise already resolved, and the
next tick is 2,000 ms of fake time away. The test then waited with
`vi.waitFor`, which under fake timers advances the clock 50 ms per check and
gives up after one real second — never reaching the next tick. On an idle
machine the first read always finished first; on a loaded runner it did not.

This is a stall, not a slow check, so a wider budget is not the remedy
(`quality-gates`: "A check stalls rather than slows").

## What Changes

- The test's final wait advances the fake clock a whole check interval on
  each attempt, so a lost wake is followed by the next tick instead of a
  timeout, and it states its own wait budget.
- No product code changes. In a real run a lost wake costs one interval: the
  next tick reads the list again.

## Capabilities

### New Capabilities

None.

### Modified Capabilities

- `quality-gates`: a test on a faked clock moves that clock to what it waits
  for.

## Impact

- `packages/core/src/stop-boundary.test.ts`.
