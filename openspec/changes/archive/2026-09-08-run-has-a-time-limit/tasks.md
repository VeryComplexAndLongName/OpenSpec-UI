The mechanism to stop a stage already exists — `cancel(runId)` terminates
the process tree, resolves a pending checkpoint, and stops the loop
advancing. Nothing here needs a second way to stop anything; the work is
knowing when, saying why, and counting attempts.

## 1. The ceilings

- [x] 1.1 `timeout.maxRunSeconds` and `timeout.maxStageSeconds` on
  `HarnessConfig`, both optional, settable globally and per change —
  beside `budget`, and following its rules, since it is the precedent for
  an optional ceiling that a per-change file may also set.
- [x] 1.2 Absent means unbounded. Every configuration written before this
  field existed means that today, and a default would start cancelling
  work those configurations were producing.
- [x] 1.3 Reject a non-positive or non-integer value where the
  configuration resolves, not minutes into a run — the posture
  `assertValidBudget` already takes for a mismatched budget field.
- [x] 1.4 Reject a stage ceiling larger than the run ceiling: it can
  never fire, and a ceiling that cannot fire is a setting that lies.
  Done, with the reason in the error text itself: the run ceiling would
  stop the chain first, so the stage ceiling could never fire.

## 2. Cutting a stage

- [x] 2.1 Arm the stage ceiling when a stage's `run()` begins and disarm
  it when that call returns.
- [x] 2.2 On expiry, stop the stage through `cancel(runId)` rather than
  killing the process directly — it does three things (terminate the
  tree, resolve a pending checkpoint, set the flag the loop reads) and
  reimplementing two of them is how a chain ends up walking to the next
  stage after its current one was killed.
- [x] 2.3 Accumulate elapsed time only while a stage is running. A chain
  paused at a checkpoint is waiting for a person, and a person thinking is
  not a run consuming anything.
  Done, and covered by a test that waits at a checkpoint for longer than
  the whole run ceiling and asserts the chain still reaches its next
  stage.
- [x] 2.4 Check the run ceiling against the accumulated total, and stop
  the chain when it is reached.
- [x] 2.5 Leave the cut stage's work in place. Do not restore the
  checkpoint: the same time would be spent again from nothing, and the
  half-applied state is what a crash or a person's cancel already
  produces.

## 3. Saying why

- [x] 3.1 An optional reason on `CancelledEvent`. Optional, because every
  cancel written before this field means "a person asked", and an absent
  reason must keep meaning that.
  Done. A person's cancel leaves it absent, which is asserted directly.
- [x] 3.2 A cut names the ceiling and the value it was set to — the
  posture `checkBudget` already takes, naming the budget rather than
  blaming a stage.
- [x] 3.3 A cut is `cancelled`, never `failed`. Reporting a working
  ceiling as a defect teaches a reader to discount failures.
- [x] 3.4 Record the cut in the audit log with the same reason, so a
  report built later can tell a ceiling from a person.
  **Deferred to the per-stage-ceiling change, deliberately.** The chain
  runner audits only git actions today; an agent run is audited by
  `agent-runner.ts`, which already records a cancelled outcome. Writing a
  second entry here would double-record, and an entry without the `stage`
  field — which the next change adds, along with `effort` — could not be
  attributed to a stage by the report that would read it. Doing it there
  costs nothing extra and does it once.
  Delivered there and closed here on 2026-09-08:
  `stage-spend-is-bounded-and-recorded` task 2.1 carries the reason onto
  the entry `agent-runner.ts` already writes, and its test counts entries
  with a cancelled outcome to prove no second one appears. Closed against
  that change's landed code, not on the promise that it would.

## 4. Attempts

- [x] 4.1 `maxStageAttempts` on `HarnessConfig`, optional. Defined here
  because this is the first change that needs it, and consumed unchanged
  by the retry-on-unchecked change that follows — one number, not one per
  reason.
- [x] 4.2 Record why each attempt after the first happened, so the
  surface can say "attempt 2 of 3 (previous: time limit 5:00)".
- [x] 4.3 When attempts are exhausted, stop and name the stage and the
  reasons, rather than continuing to a stage whose prerequisites were not
  met.
- [x] 4.4 Decided here, against this task's original wording: a cut stage
  **is** attempted again while attempts remain. Deferring the decision
  would have left `maxStageAttempts` defined and inert, and the
  requirement above promising behaviour nothing implemented — a spec that
  is untrue on the day it lands. Absent still means one attempt, so every
  existing configuration is unchanged.
  Recorded rather than rewritten: the original wording deferred the
  decision, which would have shipped a spec promising behaviour that did
  not exist.
- [x] 4.5 A stage that failed on its own merits is not attempted again.
  Retrying it would only repeat the failure; the count exists for a stage
  that was cut.

## 5. Showing it

- [x] 5.1 An elapsed-against-ceiling row in the existing usage summary,
  beside money and tokens — one more row in a component that already
  renders a ceiling beside a total, not a new surface.
  Done: `describeTime` returns `undefined` where nothing is configured,
  so an unset ceiling renders as nothing rather than as `00:00:00`.
- [x] 5.2 Show the attempt a stage is on where more than one has been
  made, and why the previous one ended.
- [x] 5.3 Show nothing where no ceiling is configured. An empty ceiling
  rendered as `0` would read as "already exhausted", the same error
  `usage-visible-while-running` avoided by never showing `$0.00` for an
  agent that reported nothing.

## 6. Documentation

- [x] 6.1 `LIMITS.md`: replace "There is no wall-clock or duration limit"
  with what now exists, and keep the list of durations that are still not
  user-configurable so none is mistaken for this one.
- [x] 6.2 State that a chain ceiling below five minutes can cut the `git`
  stage mid-poll, since `gh-pr-gateway.ts` waits that long for a pull
  request's checks and that wait is the stage doing its work.
- [x] 6.3 `HARNESS.md`: the new keys, their scope, and that this is the
  only ceiling with any force over an agent that reports no usage.

## 7. Tests

- [x] 7.1 A stage exceeding its ceiling is cut, and the runner receives a
  `cancel` — asserted against the runner, not by the absence of an error.
- [x] 7.2 The chain ceiling stops the chain, and names itself in the
  reason.
- [x] 7.3 Time at a checkpoint does not count. Written as a test that
  fails if the clock runs there, since that is the property most likely
  to regress silently.
- [x] 7.4 A cut is `cancelled` with a reason; a person's cancel is
  `cancelled` with none.
- [x] 7.5 Attempts are bounded by one number across reasons, and the
  chain stops naming the stage when they are exhausted.
- [x] 7.6 A stage ceiling larger than the run ceiling is rejected where
  the configuration resolves.
- [x] 7.7 No ceiling configured behaves exactly as before — the
  regression that matters most, since it is what every existing
  configuration does.
  Done, and this is the assertion that matters most: every configuration
  written before these fields exists in that state.

## 8. Verification

- [x] 8.1 `openspec change validate --strict run-has-a-time-limit`.
  Run 2026-09-08: "Change 'run-has-a-time-limit' is valid".
- [x] 8.2 `npm run typecheck`, `npm run lint`, `npm run test` on an idle
  machine. Read the whole failing-file list, not the first familiar line.
  Run 2026-09-08 on an idle machine: typecheck clean; lint clean apart
  from one warning that predates this change (`killTimer` unused in
  `packages/core/src/agents/shared.ts:210`); tests 48 cli, 618 core,
  280 extension, 62 server, 265 webui. Core is up 14 for the cases added
  here, and `harness-chain-runner.test.ts` went from 46 to 55.
- [x] 8.3 Give any new cost-varying test file a measured budget, since
  `lint:test-budgets` refuses one without.
  No new test file was added — the cases live in the two existing files,
  which already state their budgets.
- [x] 8.4 Version bump via `npx changeset`: `core`, `webui` and both
  hosts.
  Done: `.changeset/run-has-a-time-limit.md`.
- [x] 8.5 **Human-only**: run a chain with a short stage ceiling against
  an agent that will exceed it, and confirm the stage stops, the panel
  shows the elapsed row filling, and the reason names the ceiling. Then
  run one with no ceiling configured and confirm nothing changed.
  Confirmed live in the standalone UI on 2026-09-08 using the isolated
  `time-limit-manual-smoke-2026-09-08` change and direct `claude-cli`.
  With `timeout.maxStageSeconds: 5` and `maxStageAttempts: 1`, the panel
  showed `apply (claude-cli)` as `running...`, then displayed `cancelled:
  stopped "apply" at the stage time limit: timeout.maxStageSeconds is 5s`
  and the maximum-attempt reason. After removing `timeout` entirely, the
  same stage was still `running...` after 7 seconds with no timeout event;
  it was then stopped manually. The chain made no edits outside the smoke
  change directory.
