## Why

`change-timeline.test.ts` and `sprint-report.test.ts` have been failing
intermittently for days. Every task list written in that time carries a
note calling them "pre-existing Windows timeout flakes at 5000 ms under
load", and every review has had to re-establish that a red suite was not
a regression.

Measured on 2026-09-02, on an otherwise idle machine:
`change-timeline.test.ts` alone passes **14/14 twice**, taking **14.7 s
and 16.1 s** of test time. Vitest's per-test default is **5000 ms**. The
suite is not flaky in the usual sense — it is close enough to its ceiling
that any co-load tips it over, and running a harness agent alongside it
reliably does. On one such run it reported twelve failures across the two
files; on an idle machine the same commit passed everything.

The cost is process spawns, not computation. Both files build a real git
repository per test:

```ts
await git.init();
await git.addConfig("user.email", "test@example.com");
await git.addConfig("user.name", "Test User");
// then, per commit:
await git.add(".");
await git.commit(message);
```

That is three subprocesses to create a repository and two more per
commit. A test with three commits spawns nine `git` processes before the
code under test runs its own `blame`/`log`. Across the roughly ten
repository-building tests in the two files that is over a hundred
spawns — and on Windows a spawn, not the git operation, is the dominant
cost.

The consequence is worse than slow tests. A note saying "this failure is
expected" trains everyone to stop reading a failing suite. This
repository has already paid for that once this week: `npm run lint` was
failing for an unrelated reason, every task list said so, and a real
eslint error reached CI unchecked because the red was expected.

## What Changes

- `packages/core/src/change-timeline.test.ts` and
  `sprint-report.test.ts`: reduce the number of `git` subprocesses each
  test needs — configure identity without two extra spawns, and share a
  built repository between tests that only read from it.
- Both files: an explicit per-test timeout, sized to what the remaining
  work actually costs, so the suite states its own budget instead of
  inheriting a default it was never measured against.
- Every `tasks.md` note describing these two files as expected flakes
  becomes untrue and is removed by whoever next touches those lists; this
  change removes them from the templates it can reach.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

(none — test infrastructure only, no product behavior changes.
`.openspec.yaml` sets `skip_specs: true` accordingly, matching
`openspec/changes/archive/2026-09-01-ci-job-timeouts/` and
`.../2026-09-01-task-granularity-rules/`.)

## Impact

- Two test files in `packages/core`. No `src` change outside tests, and
  no change to what they assert.
- CI's "Typecheck, lint, test, and build" job gets faster and stops
  depending on runner load for its result.

## Explicitly out of scope

- Replacing real `git` with a mock or an in-memory implementation. These
  tests exist to exercise real `git blame`/`log` output parsing; mocking
  that away would delete the coverage rather than speed it up.
- Raising vitest's global default timeout. That would hide the same
  problem in every other suite.
- The `sprint-report-pdf` and other suites, which do not build
  repositories.
