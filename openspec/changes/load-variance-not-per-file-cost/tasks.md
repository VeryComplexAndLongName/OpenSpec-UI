Two changes before this one budgeted their way to a usable suite and were
right to. This one starts from what a budget cannot answer, so the first
section is measurement and the second does not begin until it has a
cause. If section 1 shows the variance is inherent to this machine rather
than to the suite, that is a finding and this change says so instead of
configuring something.

## 1. Establish what the variance is

- [ ] 1.1 Reproduce it: run `packages/core` under the eight-worker CPU
  co-load at least five times with budgets lifted, recording every test's
  duration. `workbench.test.ts`'s "discovers config, change artifacts,
  archive, and canonical specs" moved between 0.6 s and 16.2 s across two
  such runs; establish the distribution rather than the two endpoints.
- [ ] 1.2 Separate the pool from the machine. Repeat 1.1 with
  `--no-file-parallelism`, and again with `--maxWorkers 2` (a
  space-separated value — `=` makes vitest read it as a file filter and
  report "no tests"). If the variance collapses when files stop running
  in parallel, it is the pool; if it survives, it is the machine.
- [ ] 1.3 Separate the filesystem from the CPU. The co-load used so far
  is pure CPU. Run 1.1 again with the co-load replaced by concurrent
  temp-directory churn at a comparable intensity. These suites create,
  read and delete real directories; if that is what contends, a CPU
  co-load has been measuring the wrong thing all along.
- [ ] 1.4 Name the cause, or name what would identify it and why this
  measurement could not. A change that ends "unclear" having said so is
  worth more than one that ends with a number.

## 2. Act on the cause, not on the symptom

- [ ] 2.1 If it is the pool: configure the pool. `vitest.workspace.ts`
  already isolates `git.push.test.ts` into a single-fork project for
  exactly this class of problem, and that pattern is the precedent to
  extend rather than reinvent.
- [ ] 2.2 If it is the filesystem: the remedy is fixture design — fewer
  real directories, shared read-only fixtures — not a wider ceiling. Size
  the work and propose it separately rather than doing it here.
- [ ] 2.3 If it is inherent to the machine: say so, and re-derive what a
  budget should be sized from when a single measurement cannot be
  trusted. The convention in the repository is 3x the loaded figure;
  under a 27x swing that convention needs restating, not repeating.
- [ ] 2.4 Whatever the cause, do not raise a budget to make the variance
  go away. Both preceding changes refused that in writing.

## 3. The tinypool crash

- [ ] 3.1 Carried from `suite-survives-a-loaded-machine`: `RangeError:
  Maximum call stack size exceeded`, then a `TypeError` inside
  `node_modules/tinypool/dist/index.js`, in `packages/webui` under
  co-load. Not reproduced since — once under `--no-file-parallelism`, and
  once across a full 263-test co-loaded run that passed clean.
- [ ] 3.2 If section 1 identifies pool contention, check whether this is
  the same phenomenon before treating it separately.
- [ ] 3.3 If it stays unreproducible, record what would catch it next
  time — the reporter output to keep, the run to preserve — so a third
  sighting starts from more than the first two did.

## 4. A budget the check cannot see

- [ ] 4.1 `harness-chain-runner.test.ts` fails under load through
  `vi.waitFor`'s ceiling, not `testTimeout`, and reports "expected
  { kind: 'started' } to match object { kind: 'completed' }" — an
  assertion mismatch that is not one. Find every in-test waiting ceiling
  in the suite; `vi.waitFor` is the one that is known.
- [ ] 4.2 Make such a failure name itself, so a reader can tell it from a
  regression. A message from the wait, rather than from the comparison
  that followed it, is the minimum.
- [ ] 4.3 Decide whether `scripts/check-test-budgets.mjs` should require
  these ceilings to carry a recorded measurement the way `testTimeout`
  does — and if so, add it there rather than as a convention nobody
  checks.

## 5. Verification

- [ ] 5.1 `openspec change validate --strict load-variance-not-per-file-cost`.
- [ ] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 5.3 Re-run the co-loaded suite after any change made here, twice,
  and record both. One pass is what let the 27x swing through.
- [ ] 5.4 No changeset expected: test infrastructure only. If that stops
  being true, this line is the one that was wrong.
