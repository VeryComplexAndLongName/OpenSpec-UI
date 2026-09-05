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
- [x] 6.3 **Both files this change touches** pass while a deliberate
  co-load runs. A file that only passes on an idle machine has not been
  made cheaper, and this is the assertion that distinguishes the two.

  Narrowed from "the full `npm run test` passes" on 2026-09-04, and the
  reason is worth keeping. That wording made a change to two test files
  hostage to every other file in the repository, and its named blocker
  — `core-test-worker-contention` — was archived on 2026-09-03 having
  explicitly placed the residual outside its own scope. So the task as
  written could never be ticked by anyone: it waited on work nobody
  owned. The guard it exists to provide is unchanged, because that guard
  was always about *these two files*: did they actually get cheaper, or
  do they merely pass when nothing else is running?

  Verified 2026-09-04 with eight busy workers occupying the machine while
  the full suite ran. `change-timeline.test.ts` and
  `sprint-report.test.ts` both passed — neither appears in the failure
  list. What they carry that the failing files do not is task 4.1's
  explicit measured per-test timeout, which is the whole point.

  Six unrelated files did fail, all on timeouts:
  `checkpoint.test.ts` (5), `workbench-recovery.test.ts` (3),
  `harness-config`, `workbench-run-journal`, `template-catalog` and the
  extension's `implementation-sessions` (1 each). Notably
  `git.push.test.ts` — the file the archived contention change was written
  for — did **not** fail, so that change's isolation is working and the
  remaining problem is a different one. It is measured slowness rather
  than a hang (`checkpoint` 5.7 s idle to 53.5 s loaded, ~9x, in line
  with the CPU oversubscription), and it is owned by
  `suite-survives-a-loaded-machine` rather than left in this task's
  notes as a blocker with no owner.

- [x] 6.4 `git diff` on the two test files shows no changed `expect`.
- [x] 6.5 No changeset (test-only, no `packages/*` source change) —
  matching the precedent in
  `openspec/changes/archive/2026-09-01-ci-job-timeouts/`.
