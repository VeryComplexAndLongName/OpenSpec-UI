## Why

Six test files fail when the machine is busy, and nothing owns that.

Measured 2026-09-04, running the full `npm run test` with eight busy
workers occupying this machine:

| File | Idle | Under load | Failures |
| --- | --- | --- | --- |
| `checkpoint.test.ts` | 5.7 s | 53.5 s | 5 |
| `workbench-recovery.test.ts` | 2.5 s | 30.1 s | 3 |
| `workbench-run-journal.test.ts` | 2.5 s | 25.7 s | 1 |
| `template-catalog.test.ts` | 0.2 s | 7.1 s | 1 |
| `harness-config.test.ts` | 1.1 s | 6.8 s | 1 |
| `implementation-sessions.test.ts` (extension) | — | 16.5 s | 1 |

Every failure is a timeout at vitest's 5000 ms default.

Two things this is **not**, both worth stating because this repository has
misdiagnosed load failures twice already.

It is not the worker contention `core-test-worker-contention` fixed. That
change isolated `git.push.test.ts` into its own single-fork project, and
under this co-load `git.push.test.ts` **passed** — it is not in the
failure list at all. Its isolation works; what remains is a different
problem.

It is not a hang. `git.push.test.ts`'s original defect was a genuine
stall — 2.6 s alone, past 20 s beside one other file, with no progress —
which is why that change's proposal warns that "a timeout only changes
which number the failure reports". Here the ratios are 6x to 12x under
roughly 8x CPU oversubscription: proportionate slowness, where a measured
ceiling is the right instrument rather than a mask.

The fix is already established in this repository, three times over:
`load-sensitive-test-timeouts`, `task-checklist-timeout-ceiling`, and
`git-fixture-test-cost`'s own task 4.1. That last one is the proof —
under the same co-load, the two files carrying its explicit measured
ceilings passed while these six did not.

Left alone, the suite stays a detector of how busy the machine is, and a
real regression under load is indistinguishable from noise.

## What Changes

- Each of the six files gets an explicit per-test or per-file timeout,
  sized from a measurement recorded beside it — not a global default
  raised for everything.
- Each is first checked to be slow rather than stalled, so a ceiling is
  never used to hide a defect of the kind `git.push.test.ts` had.

## Capabilities

### Modified Capabilities

- `quality-gates`: a check states its own time budget where its cost is
  known to vary with the machine, rather than inheriting a default it was
  never measured against.

## Impact

- Six test files. No `packages/*/src` production source changes, nothing
  published, no changeset.

## Explicitly out of scope

- **Raising the global `testTimeout`.** That hides load sensitivity
  everywhere instead of budgeting the tests whose cost is known to vary,
  which is what `load-sensitive-test-timeouts` decided against.
- **Making the tests faster.** Some of these genuinely do filesystem work
  — `checkpoint.test.ts` captures and restores real trees. Reducing that
  work is a different change, and would need its own evidence that the
  coverage survives.
- **Chasing `template-catalog.test.ts`'s ratio without looking.** At 0.2 s
  to 7.1 s it is ~35x, well outside the 6-12x the others show. That is a
  reason to examine it first, not a reason to fit it with a ceiling like
  the rest.
- **CI.** GitHub's runners pass today; this is about a developer machine
  under real use, and about the suite meaning something when it is run
  there.
