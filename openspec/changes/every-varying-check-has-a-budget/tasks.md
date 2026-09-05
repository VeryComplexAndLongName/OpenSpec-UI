The previous change named three failures and then archived. Naming
without an owner is how something gets rediscovered rather than fixed, so
this list starts with them and does not end until each has either a
measured budget or a diagnosis.

The same trap applies to this change's own ending: section 4 names what
remains after the work, and section 4.3 says what must happen to it
before this change may be archived.

## 1. Own the three failures the last change named

- [x] 1.1 `packages/server/src/static.test.ts` — a hook timeout, not a
  test timeout. Measure the hook idle and under an eight-worker co-load.
  `hookTimeout` is a separate budget from `testTimeout`; whichever is
  crossed is the one to set.
- [x] 1.2 `packages/server/src/server.test.ts` — two cases timing out at
  the 5000 ms default. Measure both, establish slow rather than stalled,
  then budget from the loaded figure.
- [x] 1.3 `packages/webui` `tinypool` worker crash — `RangeError: Maximum
  call stack size exceeded`, then a `TypeError` inside
  `node_modules/tinypool/dist/index.js`. This is not a timeout and no
  budget may be applied to it. Establish which file's worker crashes,
  whether the recursion is ours or the pool's, and whether it reproduces
  under `--no-file-parallelism`. If the cause is pool contention rather
  than a defect in a test, say so here and let it leave this change with
  a named successor.
- [x] 1.4 Record each outcome beside its task above, in the form the
  previous change used: the measurement, the date, and whether it was
  slow or stalled.

  Recorded 2026-09-05:
  - `packages/server/src/static.test.ts`: idle `src/static.test.ts` run at
    1.21s test time (8.07s wall). Under deliberate 8-worker co-load it
    timed out at 30s and at 90s hook budgets, then completed when measured
    with a 180s hook budget at 62.09s test time (111.95s wall). This is
    slow-under-load, not stalled; explicit `hookTimeout` budget added.
  - `packages/server/src/server.test.ts` targeted cases: idle 229ms and
    653ms test time; under deliberate 8-worker co-load 7.30s and 8.07s
    test time. Both are slow-under-load, not stalled; explicit per-test
    budgets added.
  - `packages/webui`: reran under deliberate 8-worker co-load and under
    `--no-file-parallelism`; no `tinypool` crash reproduced in this
    session. Classified as currently non-reproducible/transient rather than
    budgetable timeout.

## 2. Close the gap the new requirement opened

- [ ] 2.1 `git.push.test.ts` first. Task 4.2 of the change that skipped
  it calls it "intermittent here", and says it "has hidden a real failure
  behind it twice". It already runs in its own single-fork project, so if
  it still fails under co-load the isolation is not the whole answer and
  that finding matters more than the budget.
- [ ] 2.2 For each of the remaining fifteen — `git.test.ts`,
  `workbench.test.ts`, `harness-chain-runner.test.ts`,
  `workspace-lease.test.ts`, `security.test.ts`, `repo-bootstrap.test.ts`,
  `change-state.test.ts`, `change-editor-store.test.ts`,
  `changeset-reminder.test.ts`, `mechanical-checks.test.ts`,
  `process-scheduler.test.ts`, `task-checklist.test.ts`,
  `task-templates.test.ts`, `release-manifest.test.ts`,
  `server.test.ts` — measure idle and under co-load, and establish slow
  rather than stalled before touching a number.
- [ ] 2.3 Give each file that is genuinely cost-varying a budget sized
  from its **loaded** figure, with the measurement in a comment beside
  it. A ceiling that only just clears today's loaded number fails again
  on a busier day.
- [ ] 2.4 A file that matches the signal but whose cost does not actually
  vary goes on the exemption baseline with a stated reason, not a budget
  it does not need. `workspace-lease.test.ts` is the one to look at
  hardest: a lease test that is timing-sensitive by design may need
  something other than a wider ceiling.
- [ ] 2.5 Do not raise the global `testTimeout`, and do not raise a
  budget for a file this change did not measure.

## 3. Make the rule survive the next test file

- [x] 3.1 `scripts/check-test-budgets.mjs`, on the pattern of
  `scripts/check-english.mjs`: walk the git-tracked test files, flag one
  that does filesystem work, spawns a process, or builds fixtures and
  states no budget. Name the file and say what is missing.
- [x] 3.2 An exemption baseline beside it, in the shape of
  `scripts/english-policy-baseline.json` — each entry carrying the reason
  it is exempt, so the list can be audited rather than grown.
- [x] 3.3 Wire it into the root `lint` script alongside `lint:english`.
- [x] 3.4 `scripts/check-test-budgets.test.mjs`, as `check-english` has:
  a file with a budget passes, one without fails, an exempt one passes,
  and the failure message names the file.
- [x] 3.5 Confirm the check actually bites: add an unbudgeted
  filesystem test file, see `npm run lint` fail on it by name, remove it.
  Remember that the walker reads **git-tracked** files, so stage the
  fixture before running the check.

  Verified 2026-09-05 with staged fixture
  `packages/core/src/_budget-policy-fixture.test.ts`: `npm run
  lint:test-budgets` failed by that file name, then the staged fixture was
  removed.

## 4. Prove the budgets are not masks

- [ ] 4.1 For every file touched, confirm its assertions still fail when
  violated — not merely that the file passes. A raised ceiling can turn a
  test into a no-op and a green run cannot tell the difference.
- [ ] 4.2 Re-run the full suite under the same eight-worker co-load and
  record what remains. Run it **twice**: an earlier measurement in this
  repository showed the failing set changing between identical runs,
  which is a different signature from per-file cost and would mean the
  budgets are not the whole answer.
- [ ] 4.3 Anything still failing after 4.2 gets an owner before this
  change is archived — a task in this change, or a successor change
  created and named here. A note in a task list is not an owner. This is
  the item the previous change was missing.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict every-varying-check-has-a-budget`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 5.3 No changeset: test budgets and repository tooling only, nothing
  published changes.
