Raising a timeout is the easy half and the dangerous half. This
repository has a file whose real defect was a stall, and whose proposal
says plainly that "a timeout only changes which number the failure
reports". Establish slow-not-stalled for each file before touching its
budget, or this change becomes the thing it is guarding against.

## 1. Tell slowness from a stall, per file

- [ ] 1.1 For each of the six, run it alone and under a deliberate
  co-load and record both durations. A ratio in line with the CPU
  oversubscription is slowness; a file that hangs far past its idle cost,
  or shows no progress, is not.
- [ ] 1.2 `template-catalog.test.ts` first: 0.2 s to 7.1 s is ~35x,
  against 6-12x for the others. That gap is the reason to look, not a
  number to fit a ceiling around. If it turns out to be a stall, it
  leaves this change and gets diagnosed on its own.
- [ ] 1.3 Any file that turns out to stall is removed from section 2 and
  named here as needing diagnosis, rather than being given a bigger
  number.

## 2. Give each file a measured budget

- [ ] 2.1 `checkpoint.test.ts` — 5.7 s idle, 53.5 s loaded, 5 failures.
- [ ] 2.2 `workbench-recovery.test.ts` — 2.5 s idle, 30.1 s loaded, 3.
- [ ] 2.3 `workbench-run-journal.test.ts` — 2.5 s idle, 25.7 s loaded, 1.
- [ ] 2.4 `harness-config.test.ts` — 1.1 s idle, 6.8 s loaded, 1.
- [ ] 2.5 `implementation-sessions.test.ts` (extension) — 16.5 s loaded,
  1. Note: this file is being edited by
  `checkpoint-retention-and-lazy-load`; do not touch it until that lands,
  and re-measure afterwards rather than reusing this figure.
- [ ] 2.6 `template-catalog.test.ts` — only if 1.2 established slowness.
- [ ] 2.7 Size each for load, not for the idle figure. A ceiling that
  only just clears today's loaded number fails again on a busier day.
  Record the measurement in a comment beside it, as
  `task-checklist-timeout-ceiling` did.
- [ ] 2.8 Do not raise the global `testTimeout`. Budget the tests whose
  cost is known to vary; leave the default protecting the ones that
  should be fast.

## 3. Prove the ceilings are not masks

- [ ] 3.1 For each file touched, confirm its assertions still fail when
  violated — not merely that the file passes. A raised timeout can turn a
  test into a no-op, and a green run alone cannot tell the difference.
- [ ] 3.2 Re-run the full suite under the same deliberate co-load and
  record what remains. The claim of this change is that the suite stops
  reporting how busy the machine is; anything still failing is named
  rather than left for the next person to rediscover.

## 4. Verification

- [ ] 4.1 `openspec change validate --strict suite-survives-a-loaded-machine`.
- [ ] 4.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list: `git.push.test.ts` is
  intermittent here and has hidden a real failure behind it twice.
- [ ] 4.3 No changeset: test budgets only, nothing published changes.
