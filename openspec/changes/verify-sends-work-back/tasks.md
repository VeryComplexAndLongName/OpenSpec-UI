The rule is already written in this file: `determineStartStage` decides
where a chain begins with `tasks.unchecked > 0 ? "apply" : "verify"`. The
work is applying it to a chain that is already running.

## 1. The return

- [x] 1.1 After `verify`, read the task count. Where tasks are unchecked
  and `apply` has attempts left, return to `apply` rather than continuing
  to `archive`, which would refuse.
- [x] 1.2 Only from `verify`, and only to `apply`. A general "step back"
  is a different thing, and `HARNESS.md` records why a chain runs forward
  only — that record stays true for every other stage.
- [x] 1.3 A chain whose sequence has no `apply` — one resumed directly at
  `verify` — does not gain one. Stop instead: running a stage the chain
  was never asked to run is the chain doing something nobody requested.

## 2. Bounded by the counter that already exists

- [x] 2.1 A return counts as an attempt of `apply`, against
  `maxStageAttempts`. Do not add a second ceiling for this reason —
  `run-has-a-time-limit`'s design rejected that, because two ceilings of
  three become nine runs of a stage nobody configured.
- [x] 2.2 Count attempts per stage rather than per loop iteration. A
  returning chain re-enters the iteration, so a count local to it would
  reset; and a slow `verify` must not consume the allowance meant for
  `apply`.
  Done: `attemptsByStage` on the chain state. A counter local to the
  loop would have reset on every return, so the chain would have looped
  indefinitely while appearing to respect its ceiling.
- [x] 2.3 Record the reason, so the surface can say "apply, attempt 2 —
  verification left 2 tasks unchecked" rather than showing the same stage
  twice with nothing to distinguish it.
- [x] 2.4 Absent means one attempt, so a chain that configures nothing
  behaves exactly as it does today: `verify` unchecks, `archive` refuses.
  This is the regression to protect.
  This caught a real defect. The first implementation reported its own
  failure where nothing was configured, replacing `archive`'s refusal and
  breaking the existing test that asserts it. The guard now keeps this
  path out of the way entirely below two attempts.

## 3. What the stop says

- [x] 3.1 Name the tasks that are still unchecked, not only how many.
  The reader is about to take the work over, and the file they would open
  is already read by `countTasks`.
  Truncated at five with a count of the rest, so a change with forty open
  tasks does not produce a message nobody reads.
- [x] 3.2 Keep it a failure, not a cancellation. Unlike a ceiling firing,
  this is the chain reporting that the work is not done — which is what
  `archive` already reports today, and the reader acts the same way.

## 4. Tests

- [x] 4.1 `verify` leaving tasks unchecked returns to `apply`, with the
  reason recorded on the new attempt.
- [x] 4.2 The return is bounded: with two attempts allowed, `apply` runs
  twice and then the chain stops.
- [x] 4.3 The stop names the unchecked tasks.
- [x] 4.4 With no attempt count configured, the chain behaves exactly as
  before and reaches `archive`'s refusal — asserted directly, since it is
  what every existing configuration does.
  Asserted on `archive`'s own wording, not on a message this change
  added — otherwise the test would have passed against the defect
  described in 2.4.
- [x] 4.5 A chain entered at `verify` does not run `apply`.
  Written after these two were briefly ticked with no test behind them —
  caught on review of this file, not by anything automated. The test
  enters at `verify` (nothing unchecked) and has the stage uncheck a task,
  which is the only way this state arises.
- [x] 4.6 Attempts spent on one stage do not reduce another's.
  Asserted by counting both stages' starts: `apply` runs twice because it
  was sent back, and `verify` must still get its second run. A single
  shared tally would have stopped it.

## 5. Verification

- [x] 5.1 `openspec change validate --strict verify-sends-work-back`.
  Run 2026-09-08: "Change 'verify-sends-work-back' is valid".
- [x] 5.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 627 core,
  280 extension, 62 server, 265 webui — core up 5.
- [x] 5.3 Version bump via `npx changeset` for `@openspec-ui/core`.
  Done: `.changeset/verify-sends-work-back.md`.
- [x] 5.4 `HARNESS.md`: its "A chain runs forward only" section becomes
  untrue as written. Correct it to state the one edge that exists and why
  it is not a general step-back, rather than deleting the section — the
  reasoning in it is still the reason there is no general one.
- [ ] 5.5 **Human-only**: run a chain on a change with a task whose
  mechanical check fails, with attempts allowed, and confirm `apply` runs
  again and the panel says why. Then run the same with no attempt count
  and confirm the archive refusal is unchanged.
