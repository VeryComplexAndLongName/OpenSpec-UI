## Why

`task-checklist.test.ts`'s repository-wide parse test carries this
comment:

> Reads and parses every tasks.md in the repository — around twenty files
> today and one more with each change — so it grows with the repository
> and needs a ceiling that does not. Measured at ~2 s alone; it timed out
> at the 5000 ms default under a full-suite run. See
> load-sensitive-test-timeouts.

The ceiling was never applied. The `it(...)` takes no timeout argument,
so the test still runs at vitest's 5000 ms default — the exact default
the comment says it timed out at. The comment describes a fix that is not
in the code.

It failed again today, at 5024 ms under a full-suite run, once two new
change directories brought the repository to eighteen. In isolation the
same test takes 1550 ms. Nothing is wrong with the parsing: the work
simply grows with every change added, against a budget that does not.

This is the failure mode the comment predicted, in the file that predicted
it, and it will recur on the next change — sooner on a slower machine.
GitHub's runners are currently under the limit, so CI has not caught it;
it fails locally.

## What Changes

- `packages/core/src/task-checklist.test.ts`: give the repository-wide
  parse test an explicit timeout with headroom that does not have to be
  revisited every few changes, and record the measurement behind the
  number.

## Capabilities

### Modified Capabilities

- `quality-gates`: a check whose cost grows with the repository is
  bounded by its own budget rather than by a default that was chosen for
  ordinary unit tests.

## Impact

- `packages/core/src/task-checklist.test.ts` only. One argument and a
  comment; no assertion changes.

## Explicitly out of scope

- **Making the test cheaper.** Reading every `tasks.md` is the point of
  it — that is what catches a parser change against files nobody would
  otherwise re-check. Sampling would weaken the guarantee to save
  milliseconds.
- **Raising the global `testTimeout`.** That would hide load sensitivity
  everywhere instead of budgeting the one test whose cost is known to
  grow, which is what `load-sensitive-test-timeouts` decided against.
