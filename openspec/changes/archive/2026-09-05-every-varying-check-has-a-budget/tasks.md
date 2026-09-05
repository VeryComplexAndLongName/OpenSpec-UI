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

- [x] 2.1 `git.push.test.ts` first. Task 4.2 of the change that skipped
  it calls it "intermittent here", and says it "has hidden a real failure
  behind it twice". It already runs in its own single-fork project, so if
  it still fails under co-load the isolation is not the whole answer and
  that finding matters more than the budget.
- [x] 2.2 For each of the remaining fifteen — `git.test.ts`,
  `workbench.test.ts`, `harness-chain-runner.test.ts`,
  `workspace-lease.test.ts`, `security.test.ts`, `repo-bootstrap.test.ts`,
  `change-state.test.ts`, `change-editor-store.test.ts`,
  `changeset-reminder.test.ts`, `mechanical-checks.test.ts`,
  `process-scheduler.test.ts`, `task-checklist.test.ts`,
  `task-templates.test.ts`, `release-manifest.test.ts`,
  `server.test.ts` — measure idle and under co-load, and establish slow
  rather than stalled before touching a number.
- [x] 2.3 Give each file that is genuinely cost-varying a budget sized
  from its **loaded** figure, with the measurement in a comment beside
  it. A ceiling that only just clears today's loaded number fails again
  on a busier day.
- [x] 2.4 A file that matches the signal but whose cost does not actually
  vary goes on the exemption baseline with a stated reason, not a budget
  it does not need. `workspace-lease.test.ts` is the one to look at
  hardest: a lease test that is timing-sensitive by design may need
  something other than a wider ceiling.
- [x] 2.5 Do not raise the global `testTimeout`, and do not raise a
  budget for a file this change did not measure.

  Measured 2026-09-05. Every vitest package was run twice — once idle,
  once under a deliberate 8-worker CPU co-load — with `--testTimeout` and
  `--hookTimeout` lifted to 300 s for the measurement itself, so a slow
  test reported its real duration instead of dying at the default. The
  JSON reporter gives per-test durations, so one run per package replaces
  one run per file. Figures below are the **slowest single test** in each
  file, which is what a `testTimeout` is compared against.

  | File | Idle | Loaded | Budget |
  | --- | --- | --- | --- |
  | `core/harness-chain-runner.test.ts` | 1.0 s | 15.8 s | 60 s |
  | `core/git.push.test.ts` | 2.2 s | 13.1 s | 45 s |
  | `cli/release-manifest.test.ts` | 2.7 s | 10.9 s | 45 s |
  | `core/process-scheduler.test.ts` | 0.1 s | 2.6 s | 15 s |
  | `core/workspace-lease.test.ts` | 0.1 s | 1.6 s | 15 s |
  | `core/workbench.test.ts` | 0.2 s | 0.6 s | 15 s |
  | `core/security.test.ts` | 0.1 s | 0.6 s | 15 s |
  | `core/change-editor-store.test.ts` | 0.2 s | 0.5 s | 15 s |
  | `core/task-templates.test.ts` | 0.1 s | 0.4 s | 15 s |
  | `core/changeset-reminder.test.ts` | 0.0 s | 0.4 s | 15 s |
  | `core/mechanical-checks.test.ts` | 0.0 s | 0.3 s | 15 s |
  | `core/change-state.test.ts` | 0.1 s | 0.3 s | 15 s |
  | `core/openspec.test.ts` | 0.0 s | 0.2 s | 15 s |
  | `core/repo-bootstrap.test.ts` | 0.1 s | 0.2 s | 15 s |

  Every one of them is slow, not stalled: each completed under load, and
  each ratio is within the range the CPU oversubscription accounts for.
  15 s is the floor `suite-survives-a-loaded-machine` already used for a
  file whose loaded figure was well under it, and this keeps to it rather
  than inventing a second convention.

  Three files named in 2.2 turned out not to belong there, and this
  records why rather than budgeting them to make a list come out even:

  - `git.test.ts` mocks `simple-git` entirely and spawns nothing. The
    proposal listed it because a grep for `simpleGit` matched
    `vi.mock("simple-git")`. It is a fixed-cost unit test: 0.0 s idle,
    0.0 s loaded. No budget, and no exemption entry either — the check
    does not flag it.
  - `task-checklist.test.ts` already carried a per-test budget from
    `task-checklist-timeout-ceiling`. The old detector could not see that
    form and the baseline hid it. 10.4 s loaded against its 30 s budget.
  - `server.test.ts` was budgeted by the first implementation pass of
    this change.

  `packages/extension/src/test/suite/` is excluded by the check rather
  than exempted by the baseline: those files run inside a real VS Code
  Extension Development Host, where a vitest budget has no meaning.

  On 2.4: `workspace-lease.test.ts` was the file to look at hardest, and
  it is fine. It advances real time with `setTimeout(resolve, 5)` and
  asserts only that time moved, never an upper bound, so a wider ceiling
  cannot turn it into a no-op. It gets an ordinary budget.

  The exemption baseline is therefore **empty**. Nothing needed one.

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

- [x] 3.6 Correction, 2026-09-05: the first detector answered the wrong
  question in both directions, and this fixes it rather than leaving
  3.1-3.5 ticked over a check that did not work.

  Its budget signal was a regular expression with no word boundary, so
  `child.emit("close", 0)` read as `it("close", 0)` and counted as a
  stated budget. That is how `server.test.ts` passed the gate — on an
  unrelated line, not on the two per-test budgets it had just been given.
  The same accident hid `harness-chain-runner.test.ts`. The same
  expression could not match a real per-test budget at all, because
  `}, 20_000);` sits on its own line and the pattern could not cross one.
  Replaced with a small scanner that walks a test or hook call to its
  matching parenthesis, skipping strings and comments, and asks whether
  the last argument is a numeric literal.

  Its cost signal missed `node:fs`, `node:child_process` and bare
  `mkdtemp`, so a test that spawns a process would never be flagged even
  though the requirement names spawning explicitly. Broadened, which
  surfaced `openspec.test.ts`.

  `packages/extension/src/test/suite/` is now excluded by prefix rather
  than by two baseline entries: those files run inside a real VS Code
  Extension Development Host, where a vitest budget has no meaning.
  `scripts/*.test.mjs` was already excluded for the same reason, and now
  says so.

  Each failure mode is covered by a test in
  `scripts/check-test-budgets.test.mjs`, so neither can return silently.

## 4. Prove the budgets are not masks

- [x] 4.1 For every file touched, confirm its assertions still fail when
  violated — not merely that the file passes. A raised ceiling can turn a
  test into a no-op and a green run cannot tell the difference.

  Checked mechanically on 2026-09-05 rather than by reading: for each of
  the seventeen files this change touched, its first assertion was
  negated (`.toEqual(` to `.not.toEqual(`, or the equivalent for the
  matcher the file uses), the file was run alone, and the original was
  restored. **All seventeen failed with the negated assertion**, so none
  has been widened into a no-op. A file that had passed would have been
  asserting nothing.
- [x] 4.2 Re-run the full suite under the same eight-worker co-load and
  record what remains. Run it **twice**: an earlier measurement in this
  repository showed the failing set changing between identical runs,
  which is a different signature from per-file cost and would mean the
  budgets are not the whole answer.

  Run twice on 2026-09-05, `packages/core`, same eight-worker co-load,
  budgets in place. **Pass 1: one failure. Pass 2: none.**

  The failure was `workbench.test.ts`, "discovers config, change
  artifacts, archive, and canonical specs", at 16178 ms against the
  15000 ms this change had given it an hour earlier. That budget was
  sized from a measurement of **0.6 s** for the same test under the same
  co-load. Between two runs of the same thing, on the same machine, that
  one test's cost moved by a factor of 27.

  This is the signature the task was written to look for, and it is now
  measured rather than suspected. A per-file ceiling sized from one
  observation is not sound here: the observation is not repeatable to
  within an order of magnitude. Every budget in this change is therefore
  sized from the **worst** figure across all four co-loaded runs, and the
  files that swung the most say so in their comments.

  It also says something about the instrument. Budgets keep the suite
  usable on a busy machine — that much held, 543 tests, one failure
  across two passes where the pre-change state failed seven times. They
  do not explain why a fixed amount of work costs 0.6 s and then 16.2 s,
  and sizing ceilings against that variance means over-provisioning every
  file against the tail. Named in 4.3.
- [x] 4.3 Anything still failing after 4.2 gets an owner before this
  change is archived — a task in this change, or a successor change
  created and named here. A note in a task list is not an owner. This is
  the item the previous change was missing.

  Successor created: **`load-variance-not-per-file-cost`**, in
  `openspec/changes/`, not a note. It owns three things this change
  measured and could not answer with a budget:

  - the 27x swing in 4.2, which makes a ceiling sized from one
    observation unsound;
  - the `tinypool` worker crash inherited from
    `suite-survives-a-loaded-machine`, now unreproduced three times, and
    carried with everything known rather than dropped as transient;
  - `vi.waitFor`'s ceiling, a second budget a test states that neither
    `testTimeout` nor `check-test-budgets.mjs` can see, and whose
    expiry reports an assertion mismatch that is not one.

  Its first section is measurement and its second does not begin until
  there is a cause, because the remedy differs by cause and only one of
  the three candidates is fixed by anything in this change.

## 5. Verification

- [x] 5.1 `openspec change validate --strict every-varying-check-has-a-budget`.
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.

  All three pass, 2026-09-05. `lint` reports one pre-existing warning in
  `packages/core/src/agents/shared.ts` (`killTimer` assigned and unused),
  untouched by this change and left alone.
- [x] 5.3 No changeset: test budgets and repository tooling only, nothing
  published changes.
