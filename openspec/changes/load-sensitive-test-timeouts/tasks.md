The failure this change removes is a test that stops watching too early,
not a product defect. Any fix that changes an `expect`, or that makes the
chain runner do less work, has treated the wrong thing.

## 1. The failing test

- [x] 1.1 `packages/core/src/harness-chain-runner.test.ts`, "confirming a
  checkpoint resumes into the next stage's agent": give its `vi.waitFor`
  an explicit timeout. Record in a comment how long the four-stage chain
  actually takes on this machine, idle and under co-load, so the number
  is falsifiable rather than chosen.
- [x] 1.2 Do **not** change any assertion in that test. It asserts the
  right sequence — `["plan", "review", "implement", "verify"]` — and that
  sequence happens; only the watch window is wrong.

## 2. The same pattern elsewhere

- [x] 2.1 The file has seven `vi.waitFor` call sites. Give the same
  explicit timeout to each one that waits on more than a single event,
  and leave the ones waiting on a single immediate event alone — an
  unnecessary ceiling is noise, and noise is what makes the necessary
  ones unreadable.
- [x] 2.2 Check the rest of `packages/core`'s tests for `vi.waitFor` on
  comparable multi-step work and treat those the same way. Find them by
  inspection now, not by waiting for each to fail under load once.
- [x] 2.3 Do **not** raise vitest's global `testTimeout` or a global
  `waitFor` default. That hides the same problem in every suite,
  including ones with no excuse for it — `git-fixture-test-cost` task 4.2
  made the same call for the same reason.

## 3. Verification

- [x] 3.1 `openspec change validate --strict load-sensitive-test-timeouts`.
- [x] 3.2 `packages/core`'s suite passes **inside a full `npm run test`**,
  not only alone. That distinction is the whole change: the test already
  passed alone before it.
- [x] 3.3 Run the full suite with a deliberate co-load, the condition
  under which this failed on 2026-09-02, and record the result. Recorded
  2026-09-02: `harness-chain-runner.test.ts`'s four-stage chain measured
  ~453 ms isolated and ~1823 ms under deliberate full-suite co-load,
  against the 5000 ms ceiling the file now sets — see the comment on
  `CHAIN_WAIT_FOR_TIMEOUT_MS`. Verified in review: `core` passes 44 files
  / 482 tests inside a full `npm run test`, the first fully green local
  core suite this week.

  The run left `.tmp-load-sensitive-co-load.log` and
  `.tmp-load-sensitive-full-co-load.log` in the repository root. Removed
  in review — evidence belongs in the comment beside the number it
  justifies, or in a temporary directory, never as untracked files one
  `git add -A` away from being committed.
- [x] 3.4 `git diff` shows no changed `expect` and no non-test file.
- [x] 3.5 No changeset — test-only, matching
  `openspec/changes/archive/2026-09-01-ci-job-timeouts/`.
