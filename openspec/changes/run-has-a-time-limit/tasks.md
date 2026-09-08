The mechanism to stop a stage already exists — `cancel(runId)` terminates
the process tree, resolves a pending checkpoint, and stops the loop
advancing. Nothing here needs a second way to stop anything; the work is
knowing when, saying why, and counting attempts.

## 1. The ceilings

- [ ] 1.1 `timeout.maxRunSeconds` and `timeout.maxStageSeconds` on
  `HarnessConfig`, both optional, settable globally and per change —
  beside `budget`, and following its rules, since it is the precedent for
  an optional ceiling that a per-change file may also set.
- [ ] 1.2 Absent means unbounded. Every configuration written before this
  field existed means that today, and a default would start cancelling
  work those configurations were producing.
- [ ] 1.3 Reject a non-positive or non-integer value where the
  configuration resolves, not minutes into a run — the posture
  `assertValidBudget` already takes for a mismatched budget field.
- [ ] 1.4 Reject a stage ceiling larger than the run ceiling: it can
  never fire, and a ceiling that cannot fire is a setting that lies.

## 2. Cutting a stage

- [ ] 2.1 Arm the stage ceiling when a stage's `run()` begins and disarm
  it when that call returns.
- [ ] 2.2 On expiry, stop the stage through `cancel(runId)` rather than
  killing the process directly — it does three things (terminate the
  tree, resolve a pending checkpoint, set the flag the loop reads) and
  reimplementing two of them is how a chain ends up walking to the next
  stage after its current one was killed.
- [ ] 2.3 Accumulate elapsed time only while a stage is running. A chain
  paused at a checkpoint is waiting for a person, and a person thinking is
  not a run consuming anything.
- [ ] 2.4 Check the run ceiling against the accumulated total, and stop
  the chain when it is reached.
- [ ] 2.5 Leave the cut stage's work in place. Do not restore the
  checkpoint: the same time would be spent again from nothing, and the
  half-applied state is what a crash or a person's cancel already
  produces.

## 3. Saying why

- [ ] 3.1 An optional reason on `CancelledEvent`. Optional, because every
  cancel written before this field means "a person asked", and an absent
  reason must keep meaning that.
- [ ] 3.2 A cut names the ceiling and the value it was set to — the
  posture `checkBudget` already takes, naming the budget rather than
  blaming a stage.
- [ ] 3.3 A cut is `cancelled`, never `failed`. Reporting a working
  ceiling as a defect teaches a reader to discount failures.
- [ ] 3.4 Record the cut in the audit log with the same reason, so a
  report built later can tell a ceiling from a person.

## 4. Attempts

- [ ] 4.1 `maxStageAttempts` on `HarnessConfig`, optional. Defined here
  because this is the first change that needs it, and consumed unchanged
  by the retry-on-unchecked change that follows — one number, not one per
  reason.
- [ ] 4.2 Record why each attempt after the first happened, so the
  surface can say "attempt 2 of 3 (previous: time limit 5:00)".
- [ ] 4.3 When attempts are exhausted, stop and name the stage and the
  reasons, rather than continuing to a stage whose prerequisites were not
  met.
- [ ] 4.4 Do not decide here whether a cut stage is retried
  automatically. This change gives the attempt a ceiling and a reason;
  whether the chain retries on its own is bound up with the autonomy
  level and belongs with the change that uses the same counter.

## 5. Showing it

- [ ] 5.1 An elapsed-against-ceiling row in the existing usage summary,
  beside money and tokens — one more row in a component that already
  renders a ceiling beside a total, not a new surface.
- [ ] 5.2 Show the attempt a stage is on where more than one has been
  made, and why the previous one ended.
- [ ] 5.3 Show nothing where no ceiling is configured. An empty ceiling
  rendered as `0` would read as "already exhausted", the same error
  `usage-visible-while-running` avoided by never showing `$0.00` for an
  agent that reported nothing.

## 6. Documentation

- [ ] 6.1 `LIMITS.md`: replace "There is no wall-clock or duration limit"
  with what now exists, and keep the list of durations that are still not
  user-configurable so none is mistaken for this one.
- [ ] 6.2 State that a chain ceiling below five minutes can cut the `git`
  stage mid-poll, since `gh-pr-gateway.ts` waits that long for a pull
  request's checks and that wait is the stage doing its work.
- [ ] 6.3 `HARNESS.md`: the new keys, their scope, and that this is the
  only ceiling with any force over an agent that reports no usage.

## 7. Tests

- [ ] 7.1 A stage exceeding its ceiling is cut, and the runner receives a
  `cancel` — asserted against the runner, not by the absence of an error.
- [ ] 7.2 The chain ceiling stops the chain, and names itself in the
  reason.
- [ ] 7.3 Time at a checkpoint does not count. Written as a test that
  fails if the clock runs there, since that is the property most likely
  to regress silently.
- [ ] 7.4 A cut is `cancelled` with a reason; a person's cancel is
  `cancelled` with none.
- [ ] 7.5 Attempts are bounded by one number across reasons, and the
  chain stops naming the stage when they are exhausted.
- [ ] 7.6 A stage ceiling larger than the run ceiling is rejected where
  the configuration resolves.
- [ ] 7.7 No ceiling configured behaves exactly as before — the
  regression that matters most, since it is what every existing
  configuration does.

## 8. Verification

- [ ] 8.1 `openspec change validate --strict run-has-a-time-limit`.
- [ ] 8.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
- [ ] 8.3 Give any new cost-varying test file a measured budget, since
  `lint:test-budgets` refuses one without.
- [ ] 8.4 Version bump via `npx changeset`: `core`, `webui` and both
  hosts.
- [ ] 8.5 **Human-only**: run a chain with a short stage ceiling against
  an agent that will exceed it, and confirm the stage stops, the panel
  shows the elapsed row filling, and the reason names the ceiling. Then
  run one with no ceiling configured and confirm nothing changed.
