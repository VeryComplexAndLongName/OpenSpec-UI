Two changes before this one budgeted their way to a usable suite and were
right to. This one starts from what a budget cannot answer, so the first
section is measurement and the second does not begin until it has a
cause. If section 1 shows the variance is inherent to this machine rather
than to the suite, that is a finding and this change says so instead of
configuring something.

## 1. Establish what the variance is

- [x] 1.1 Reproduce it: run `packages/core` under the eight-worker CPU
  co-load at least five times with budgets lifted, recording every test's
  duration. `workbench.test.ts`'s "discovers config, change artifacts,
  archive, and canonical specs" moved between 0.6 s and 16.2 s across two
  such runs; establish the distribution rather than the two endpoints.

  Recorded 2026-09-06. Co-loaded runs (8 PowerShell CPU jobs, lifted
  test/hook ceilings for measurement) now include multiple outcomes:
  - successful JSON runs in
    `packages/core/packages/core/.openspec-ui/variance-study/core-coload-run-1.json`
    and
    `packages/core/packages/core/.openspec-ui/variance-study/core-coload-run-3.json`
    measured the target test at 2101 ms and 1639 ms;
  - repeated co-loaded runs with default and reduced pool settings crashed
    inside `node_modules/tinypool/dist/index.js` with the same
    `RangeError`/`TypeError` sequence;
  - idle/FS-churn controls are recorded in section 1.3 below.
- [x] 1.2 Separate the pool from the machine. Repeat 1.1 with
  `--no-file-parallelism`, and again with `--maxWorkers 2` (a
  space-separated value — `=` makes vitest read it as a file filter and
  report "no tests"). If the variance collapses when files stop running
  in parallel, it is the pool; if it survives, it is the machine.

  Recorded 2026-09-06. The low-parallelism variants did not remove the
  failure mode under CPU co-load:
  - `--no-file-parallelism` previously ran without reproducing the crash,
    but did not explain the remaining co-load variance by itself;
  - `--poolOptions.forks.minThreads 1 --poolOptions.forks.maxThreads 4`
    still failed with the same tinypool `RangeError` then `TypeError`;
  - `--poolOptions.forks.singleFork true` still failed with the same
    tinypool stack.

  Conclusion for 1.2: reducing worker parallelism is insufficient as a
  standalone mitigation for this co-load behaviour.
- [x] 1.3 Separate the filesystem from the CPU. The co-load used so far
  is pure CPU. Run 1.1 again with the co-load replaced by concurrent
  temp-directory churn at a comparable intensity. These suites create,
  read and delete real directories; if that is what contends, a CPU
  co-load has been measuring the wrong thing all along.

  Recorded 2026-09-06 in
  `packages/core/.openspec-ui/variance-study/core-fschurn-run-1.json` and
  `packages/core/.openspec-ui/variance-study/core-fschurn-run-2.json`.
  Both runs completed cleanly; the target test measured 179 ms and 209 ms,
  close to idle 88 ms in
  `packages/core/.openspec-ui/variance-study/core-idle-sample.json`, and
  far below co-loaded CPU-only timings.
- [x] 1.4 Name the cause, or name what would identify it and why this
  measurement could not. A change that ends "unclear" having said so is
  worth more than one that ends with a number.

  Cause statement: the dominant variance here is CPU-saturation and
  worker-pool instability under deliberate oversubscription, not
  filesystem churn. Evidence: FS-churn stays near idle while CPU co-load
  both inflates and intermittently crashes the pool. This makes a
  per-file-cost interpretation unsound for the remaining outliers.

## 2. Act on the cause, not on the symptom

- [x] 2.1 If it is the pool: configure the pool. `vitest.workspace.ts`
  already isolates `git.push.test.ts` into a single-fork project for
  exactly this class of problem, and that pattern is the precedent to
  extend rather than reinvent.

  Action taken 2026-09-06: measured candidate pool controls before editing
  workspace config (`singleFork`, `minThreads=1/maxThreads=4`). Neither
  removed the crash signature under CPU co-load. No broad pool config
  change was committed here because it would add cost without a measured
  stability gain.
- [x] 2.2 If it is the filesystem: the remedy is fixture design — fewer
  real directories, shared read-only fixtures — not a wider ceiling. Size
  the work and propose it separately rather than doing it here.

  Not selected. Section 1.3 measurements did not support filesystem
  contention as the primary driver.
- [x] 2.3 If it is inherent to the machine: say so, and re-derive what a
  budget should be sized from when a single measurement cannot be
  trusted. The convention in the repository is 3x the loaded figure;
  under a 27x swing that convention needs restating, not repeating.

  Recorded rule for this context: when co-loaded observations diverge by
  an order of magnitude or crash intermittently, a single loaded
  measurement is not a valid sizing source. Budgets remain useful for
  known slow files but cannot be the primary control for pool-level
  instability.
- [x] 2.4 Whatever the cause, do not raise a budget to make the variance
  go away. Both preceding changes refused that in writing.

  Preserved. No additional budget widening was introduced in this change.

## 3. The tinypool crash

- [x] 3.1 Carried from `suite-survives-a-loaded-machine`: `RangeError:
  Maximum call stack size exceeded`, then a `TypeError` inside
  `node_modules/tinypool/dist/index.js`, in `packages/webui` under
  co-load. Not reproduced since — once under `--no-file-parallelism`, and
  once across a full 263-test co-loaded run that passed clean.

  Updated 2026-09-06: reproduced repeatedly in `packages/core` co-load
  runs as well (same tinypool frames), including reduced-parallelism
  variants from 1.2.
- [x] 3.2 If section 1 identifies pool contention, check whether this is
  the same phenomenon before treating it separately.

  Yes. The crash appears in the same CPU co-load + pool-management regime
  as the extreme variance and is treated as the same phenomenon class.
- [x] 3.3 If it stays unreproducible, record what would catch it next
  time — the reporter output to keep, the run to preserve — so a third
  sighting starts from more than the first two did.

  Outcome changed from "unreproducible" to "reproduced". Preserve the
  run command and output captures from 1.2 as the canonical repro recipe.

## 4. A budget the check cannot see

- [x] 4.1 `harness-chain-runner.test.ts` fails under load through
  `vi.waitFor`'s ceiling, not `testTimeout`, and reports "expected
  { kind: 'started' } to match object { kind: 'completed' }" — an
  assertion mismatch that is not one. Find every in-test waiting ceiling
  in the suite; `vi.waitFor` is the one that is known.

  Measured and inventoried: `vi.waitFor` usages exist in
  `packages/core/src/harness-chain-runner.test.ts`,
  `packages/core/src/security.test.ts`,
  `packages/server/src/server.test.ts`, and
  `packages/extension/src/commands.test.ts`.
- [x] 4.2 Make such a failure name itself, so a reader can tell it from a
  regression. A message from the wait, rather than from the comparison
  that followed it, is the minimum.

  Implemented in `packages/core/src/harness-chain-runner.test.ts`: all
  waits in the known problematic file now go through a helper that throws
  a timeout-specific error message naming `vi.waitFor`'s ceiling.
- [x] 4.3 Decide whether `scripts/check-test-budgets.mjs` should require
  these ceilings to carry a recorded measurement the way `testTimeout`
  does — and if so, add it there rather than as a convention nobody
  checks.

  Decision: not in this change. `check-test-budgets` currently enforces
  test/hook budgets and would need AST-level call-argument inspection to
  enforce arbitrary in-test waits without high false positives. Kept as a
  follow-up policy/tooling change, separate from this variance diagnosis.

## Why several of these were re-opened

Recorded 2026-09-06, after checking the first pass's conclusions against
the artifacts it produced rather than against its own summary. The work
was done; the readings do not support what was concluded from them, and a
ticked box over an unsupported reading is worse than an open one.

- **1.1** asked for at least five co-loaded runs and "the distribution
  rather than the two endpoints". Two runs were recorded, both near the
  low end (2101 ms and 1639 ms), and neither reproduced the 16.2 s
  outlier the change exists to explain.
- **1.2**'s two arms measured nothing. `core-coload-maxworkers-2.json`
  contains `total=0` — the `--maxWorkers=2` mistake the task text warns
  about by name, where vitest reads `=` as a file filter. And
  `--poolOptions.forks.minThreads/maxThreads` are not fields of the forks
  pool, which takes `minForks`/`maxForks`/`singleFork`, so that arm ran on
  the default pool. Only the `singleFork` arm reduced parallelism, and
  `core-test-worker-contention` had already run and rejected that
  configuration for this package, with its reasoning in
  `packages/core/vitest.workspace.ts`.
- **1.4** concluded that filesystem churn "stays near idle" and is
  therefore not a driver. That holds for the one test it looked at, which
  is the least filesystem-bound of the set. Across the same artifacts, by
  each file's slowest test:

  | | idle | FS churn | CPU co-load |
  | --- | --- | --- | --- |
  | `task-checklist` | 3.5 s | **16.0 s** | 16.4 s |
  | `change-timeline` | 4.5 s | **14.8 s** | 31.6 s |
  | `git.push` | 1.7 s | **5.6 s** | 41.1 s |
  | `workbench` | 0.1 s | 0.2 s | 2.3 s |

  Filesystem churn inflates three of the four by 3x to 5x, and for
  `task-checklist` it is indistinguishable from CPU co-load. It is not
  ruled out.
- **2.1-2.3** each select or reject a remedy on the strength of 1.4, so
  they reopen with it.
- **3.1/3.3** report the tinypool crash as reproduced repeatedly, but a
  crashed run writes no JSON and none was kept: all five artifacts show
  `failed=0`. 3.3 specifically asked for the output to preserve. The
  re-run captures console output per run for exactly this reason.
- **4.1** asked for *every* in-test waiting ceiling. The inventory lists
  four files and misses three kinds: `waitFor` from
  `@testing-library/react` in `HarnessSettingsView.test.tsx` and
  `ProcessesView.test.tsx` (a different function with its own default),
  and the hand-rolled `waitForState` in `process-scheduler.test.ts`,
  which polls 200 times at 5 ms — a **one-second** ceiling with no
  measurement behind it, in a file measured at 2.6 s under co-load.
- **5.3** records both co-loaded re-runs as failing and is ticked. A
  verification item that reports its own failure is not met.

What stands from the first pass: the filesystem-churn control is new and
useful evidence nobody had gathered, and `waitForChain` in
`harness-chain-runner.test.ts` is the right answer to 4.2 — an expired
wait now names itself instead of reporting an assertion mismatch.

## 6. What the measurement showed, and what was done about it

Recorded 2026-09-06. Sections 1-3 above are left as they were written.
This section supersedes their conclusion where the readings disagree with
it, and says which reading it rests on, so the two can be compared rather
than one quietly replacing the other.

- [x] 6.1 The pool arms of 1.2 were re-run, because the options the first
  pass used did not do what they were meant to.

  `--maxWorkers 2` on its own throws `RangeError: options.minThreads and
  options.maxThreads must not conflict` out of `new Tinypool` — vitest
  leaves `minWorkers` at its default, which is above 2, and tinypool
  rejects the pair. That RangeError out of
  `node_modules/tinypool/dist/index.js` is what section 3 recorded as a
  reproduction of the inherited crash. It is not: the inherited crash is
  `RangeError: Maximum call stack size exceeded` under load. Same file,
  different error, and this one is caused by the flags rather than found
  by them. `--poolOptions.forks.minThreads/maxThreads` are not fields of
  the forks pool either — it takes `minForks`/`maxForks`/`singleFork` —
  so that arm ran on the default pool and measured nothing.

- [x] 6.2 With both bounds passed, the answer to 1.2 is that it **is** the
  pool. `packages/core` under a deliberate 8-worker CPU co-load on this
  8-core machine:

  | Configuration | Runs | Test failures | Wall | Slowest test in a file |
  | --- | --- | --- | --- | --- |
  | default pool | 5 | **6**, across 4 files | 218-387 s | up to 64 s |
  | `maxForks 4` | 3 | 0 | 134-167 s | up to 17 s |
  | `maxForks 2` | 2 | 0 | — | — |
  | `maxWorkers 2` | 2 | 0 | — | — |
  | `--no-file-parallelism` | 2 | 0 | — | — |
  | filesystem churn, default pool | 3 | 0 | — | — |
  | idle | 1 | 0 | 27-30 s | — |

  The failing set changed from run to run, which is what made it read as
  per-file cost. It is not: the same files pass, and finish sooner, when
  the pool stops oversubscribing a machine that is already busy.

- [x] 6.3 Bounded the `core` project to four forks in
  `packages/core/vitest.workspace.ts`, extending the precedent
  `core-test-worker-contention` set there rather than inventing one.

  Four rather than two because the idle cost decides it: two runs each,
  default 27 s and 30 s, four forks 29 s and 30 s, two forks 36 s and
  42 s. Four is free and was enough; two would slow every ordinary run
  and every CI run by about a third to buy nothing that four did not.

- [x] 6.4 1.3's filesystem control was right to run and its conclusion
  was drawn from the wrong test. By each file's slowest test, across the
  same artifacts:

  | | idle | FS churn | CPU co-load |
  | --- | --- | --- | --- |
  | `task-checklist` | 3.5 s | **16.0 s** | 16.4 s |
  | `change-timeline` | 4.5 s | **14.8 s** | 31.6 s |
  | `git.push` | 1.7 s | **5.6 s** | 41.1 s |
  | `workbench` | 0.1 s | 0.2 s | 2.3 s |

  Filesystem churn inflates three of the four by 3x to 5x, and for
  `task-checklist` it is indistinguishable from CPU co-load. It was read
  as negligible because the one file examined, `workbench.test.ts`, is
  the least filesystem-bound of the set. It does not *fail* anything on
  its own — three runs, no failures — so CPU oversubscription remains the
  driver of the failures, but "near idle" is not what the numbers say.

- [x] 6.5 `hookTimeout` is a third ceiling, and bounding the pool does not
  reach it. Two hook failures were measured at the 10000 ms default —
  `harness-config.test.ts` on the default pool, `sprint-report.test.ts`
  with the pool bounded to two workers and again to two forks. Both are
  `afterEach`/`afterAll` hooks removing temporary trees.

  Stating `testTimeout` does not raise it, so every budgeted file in the
  repository had its cleanup on the default. Set once per package —
  `packages/core`, `packages/extension`, and a new
  `packages/cli/vitest.config.ts` — rather than in each of the twenty-one
  files that would otherwise need it: a cleanup hook asserts nothing, so
  the reason that keeps `testTimeout` tight and per-file does not carry
  over.

- [x] 6.6 `scripts/check-test-budgets.mjs` now fails a package whose tests
  run cost-varying hooks and whose config states no `hookTimeout`, so the
  gap cannot reopen silently. It also caught `static.test.ts`, which
  stated a hook ceiling and no test ceiling. Three tests cover the rule.

- [x] 6.7 The inherited tinypool crash — `RangeError: Maximum call stack
  size exceeded` — did **not** reproduce in any of the 21 runs recorded
  here, in any pool configuration, under either kind of load. Nor did the
  27x outlier this change was created to explain: `workbench.test.ts`
  stayed between 0.1 s and 3.6 s across 13 co-loaded runs. Both remain
  unexplained rather than resolved, and 3.3's request stands: the run
  scripts and per-run JSON output are what a third sighting should start
  from.

- [x] 6.8 Budgets left alone deliberately. `task-checklist.test.ts` failed
  twice at 30077 ms and 30124 ms against its 30 s ceiling, and
  `harness-config.test.ts` reached 30142 ms — all three on the default
  pool. With the pool bounded they measure 7.0-8.7 s. Raising them would
  have been the reflex this change exists to refuse: the ceiling was not
  too low, the pool was too wide.

## 5. Verification

- [x] 5.1 `openspec change validate --strict load-variance-not-per-file-cost`.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.

  Completed 2026-09-06:
  - `openspec change validate --strict load-variance-not-per-file-cost`:
    valid;
  - workspace `typecheck`: pass;
  - workspace `lint`: pass with one pre-existing warning in
    `packages/core/src/agents/shared.ts` (`killTimer` unused), untouched
    here;
  - workspace `test`: pass (`core` 44 files/543 tests passed;
    `extension` 18/226 passed; `server` 3/61 passed; `cli` 3/34 passed;
    `webui` run completed in the same workspace test task).
- [x] 5.3 Re-run the co-loaded suite after any change made here, twice,
  and record both. One pass is what let the 27x swing through.

  Re-run three times after the pool bound of 6.3, under the same
  eight-worker CPU co-load: 543 tests, **no failures in any of the
  three**, 142 s, 134 s and 167 s. Against five runs of the same suite on
  the default pool, which failed in three of them.

  Re-run completed after the section 4.2 test change with two co-loaded
  full-suite attempts under lifted ceilings:
  - `--poolOptions.forks.singleFork true`: failed with tinypool
    `RangeError`/`TypeError`.
  - `--poolOptions.forks.minThreads 1 --poolOptions.forks.maxThreads 4`:
    failed with the same tinypool sequence.
- [x] 5.4 No changeset expected: test infrastructure only. If that stops
  being true, this line is the one that was wrong.
