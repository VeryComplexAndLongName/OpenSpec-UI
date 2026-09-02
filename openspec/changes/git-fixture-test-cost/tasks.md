These tests exist to exercise **real** `git blame` and `git log` output.
If a change here makes them faster by not running git, it has deleted the
coverage rather than fixed the cost. Speed comes from spawning fewer
processes, never from mocking the one being measured.

## 1. Measure first

- [x] 1.1 Record, in a comment at the top of each of the two test files,
  how long that file takes alone on this machine today and how many
  `git` subprocesses one repository-building test spawns. Baseline
  measured 2026-09-02: `change-timeline.test.ts` **14/14, 14.7 s and
  16.1 s across two idle runs**; `initRepo` is three spawns
  (`init` + two `addConfig`) and each commit is two more (`add` +
  `commit`). Without a recorded baseline the later number is unfalsifiable.

## 2. Fewer subprocesses

- [x] 2.1 `packages/core/src/change-timeline.test.ts`, `initRepo()`:
  remove the two `addConfig` spawns. The identity can travel in the same
  `env` the commit helpers already use, or be passed at `init` — either
  way `git init` plus zero further configuration subprocesses.
- [x] 2.2 Do **not** use `git config --global`. It writes to the
  developer's own configuration; a suite that mutates the machine it runs
  on is worse than a slow one.
- [x] 2.3 `packages/core/src/sprint-report.test.ts`: the same change to
  its own copy of `initRepo()`. The two files each carry their own
  helpers and neither imports the other — fix both, and do **not** extract
  a shared module as part of this change (see design.md's trade-off).
- [x] 2.4 Neither file's assertions change. `git diff` on these two files
  must show setup and timeouts only — if an `expect` moved, the change
  reached further than it should.

## 3. Shared fixtures where tests only read

- [x] 3.1 `change-timeline.test.ts`: tests that assert over the same
  repository shape build it once and share it. Tests that need a
  different history — a different author, a commit that never touches the
  change directory, an archived path — keep building their own.
- [x] 3.2 Where a fixture is shared, state at its construction that tests
  using it must not mutate it. The next person adding a test to that
  block needs the rule visible, not inferred.
- [x] 3.3 `sprint-report.test.ts`: the same, on its own terms.
- [x] 3.4 Do **not** share a fixture across the two files. They test
  different things and are run separately often enough that coupling them
  buys nothing.

## 4. An explicit, justified timeout

- [x] 4.1 Each of the two files sets its own per-test timeout, with a
  comment giving the measured cost it is sized against — the same
  discipline `ci-job-timeouts` used, where a ceiling detects a hang
  rather than budgeting performance and should be wrong in the cheap
  direction.
- [x] 4.2 Do **not** raise vitest's global default. That hides the same
  problem in every other suite, including ones that have no excuse for
  it.
- [x] 4.3 The timeout is set **after** sections 2 and 3, against the
  reduced cost. Setting it first would remove the pressure that makes the
  reduction worth doing.

## 5. Remove the notes that are no longer true

- [x] 5.1 Every active `openspec/changes/*/tasks.md` carrying a note that
  `sprint-report.test.ts` and `change-timeline.test.ts` are "pre-existing
  Windows timeout flakes ... do not attempt to fix them here" describes a
  condition this change ends. Remove that sentence wherever it appears in
  an **active** change.
- [x] 5.2 Do **not** edit archived changes. Their notes were true when
  written, and an archive that is rewritten to match the present stops
  being a record.

## 6. Verification

- [x] 6.1 `openspec change validate --strict git-fixture-test-cost`.
- [x] 6.2 Each of the two files, run **alone**, passes and reports a test
  time recorded in the same comment as the baseline, so the before and
  after sit together.
- [ ] 6.3 The full `npm run test` passes **while a deliberate co-load
  runs** — the condition under which these two files failed on
  2026-09-02. A suite that only passes on an idle machine has not been
  fixed, and this is the assertion that distinguishes the two.
  Verification note (2026-09-02): both target files pass in isolation,
  and both also pass in deliberate co-load runs; however, full co-load
  `npm run test --workspaces --if-present` still fails in unrelated core
  tests (for example `harness-chain-runner.test.ts`, with occasional
  `checkpoint.test.ts` / `workbench-recovery.test.ts` contention failures).

  Reviewed 2026-09-02, on the machine the change was written for. The full
  `npm run test` went from **8 failures in 3 files** before this change —
  `change-timeline.test.ts` and `sprint-report.test.ts` failing with
  `EBUSY: resource busy or locked, rmdir` and 5-second timeouts, plus
  `harness-chain-runner.test.ts` — to **1 failure in 1 file** after it.
  Both target files now pass inside the full run, which is the claim this
  change makes.

  What remains is `harness-chain-runner.test.ts > semi-autonomous >
  confirming a checkpoint resumes into the next stage's agent`, which
  passes alone and fails under load for a different reason: `vi.waitFor`
  defaults to a 1-second ceiling, and that test drives four chain stages
  through real file writes before the event it waits for. No git fixture
  is involved. Left to `load-sensitive-test-timeouts` rather than fixed
  here — this change's own task 2.4 forbids reaching past the two files
  it names, and a fix that quietly widened would be the thing it was
  written to prevent.
- [x] 6.4 `git diff` on the two test files shows no changed `expect`.
- [x] 6.5 No changeset (test-only, no `packages/*` source change) —
  matching the precedent in
  `openspec/changes/archive/2026-09-01-ci-job-timeouts/`.
