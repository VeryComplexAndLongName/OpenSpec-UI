Path this change must hold end to end: the Cancel button → a `cancel`
command → `agent-runner.ts` → the adapter's `AbortSignal` →
`terminateProcessTree` → the child's actual exit → a `cancelled` event →
the panel. The defect was that the event was emitted from the middle of
that path and the panel believed it. A fix that moves the optimistic
emission somewhere else on the same path has changed nothing.

Every claim here is checkable against a real process. Prefer a test that
kills something real over one that asserts a mock was called.

## 1. A state for "asked, not yet stopped"

- [x] 1.1 `packages/core/src/protocol.ts`: add a **non-terminal** event
  kind reporting that cancellation is in flight. Name it for what it
  says, and state in its own comment that it is not terminal and why
  that matters.
- [x] 1.2 Same file: leave every existing kind's meaning alone.
  `cancelled` keeps meaning the run ended; what changes is when it is
  allowed to be said.
- [x] 1.3 `packages/core/src/agent-runner.ts`: a `cancel` command emits
  the in-flight kind, not `cancelled`.
- [x] 1.4 Same file: when `activeRuns` holds no controller for that
  `runId`, say so honestly. The run may genuinely have finished between
  the click and the command — that is the case the current comment
  describes — but "nothing to cancel" and "cancelling" are different
  facts and the caller can act on the difference.

## 2. `cancelled` on the process's death

- [x] 2.1 `packages/core/src/agents/shared.ts`: the run emits `cancelled`
  when the child has exited. The spawn path already listens for `close`;
  use that, do not add a timer.
- [x] 2.2 Same file: if the child never exits, the run ends by saying
  that — a failure naming what was attempted, not a `cancelled` that did
  not happen. Decide how long to wait and record the number with its
  reason, the way `ci-job-timeouts` and `load-sensitive-test-timeouts`
  did.
- [x] 2.3 `packages/core/src/agents/acp-session-driver.ts`: same rule.
  Today `run()` returns `cancelled` on abort and `runProcess()`'s
  `finally` kills the process afterwards — the report precedes the act.
  The ACP process is long-lived, which is why this adapter kills a tree
  at all, and why it is the one the defect was reported against.
- [x] 2.4 `packages/core/src/harness-chain-runner.ts`: a chain reports
  the in-flight state when a stage is being cancelled, and `cancelled`
  once that stage's run has actually ended. Its `cancel()` already
  re-sends a `cancel` to the stage's runner; what changes is what the
  chain says while waiting.

## 3. `terminateProcessTree` finds out whether it worked

- [x] 3.1 `packages/core/src/agents/shared.ts`: wait for `taskkill` to
  exit and report the outcome. Today its error is swallowed with a
  comment saying there is no further fallback — true, and not a reason to
  discard the information.
- [x] 3.2 Same function on POSIX: `process.kill` throwing ESRCH means the
  process is already gone, which is success, not failure. Distinguish it
  from a real error.
- [x] 3.3 Distinguish "the kill could not be attempted" from "the kill
  ran and the process survived" in what reaches the user. They call for
  different actions, and a single "cancel failed" tells them apart from
  neither.
- [x] 3.4 Keep it non-throwing at the call sites that treat it as
  cleanup. The `finally` in `runProcess` must not turn a tidy-up failure
  into the run's outcome.

## 4. The panel keeps the control

- [x] 4.1 `packages/webui/src/components/HarnessChainPanel.tsx`: Cancel
  remains available while the run is still producing events, and a second
  press is allowed. `isRunning` is currently `runId !== null &&
  !collapsedEvents.some(isTerminal)`, which is sticky — that is the line
  that removed the user's only lever.
- [x] 4.2 `packages/webui/src/components/AiPanel.tsx`: the same, at
  line 877.
- [x] 4.3 Show the in-flight state distinctly from "Cancelled". A label
  that says a run ended while its output is still arriving is the
  original complaint.
- [x] 4.4 Do **not** add a second, stronger button. See design.md — two
  buttons for one intention, the second appearing only once the user has
  stopped trusting the first.
- [x] 4.5 `packages/extension`: whatever it renders for a run's state
  handles the new kind. A host that ignores it degrades to today's
  behaviour, which is the point of making the kind non-terminal, but
  degrading silently is not the same as being correct.

  `describe-event.ts` names it. The compiler found this one: its switch
  over `Event["kind"]` is exhaustive, so adding the kind failed the build
  in both hosts until each had a case. "Both hosts must handle it" was an
  intention in the proposal and a compile error in practice.

## 5. Tests

- [x] 5.1 `agent-runner.test.ts`: a `cancel` for an active run emits the
  in-flight kind and **not** `cancelled`; `cancelled` follows only once
  the child has exited.
- [x] 5.2 Same file: a `cancel` for a `runId` with no active run says so,
  and does not claim to have cancelled anything.
- [x] 5.3 `agents/shared.test.ts`: a real spawned process that ignores a
  polite signal is still reported as cancelled once it is gone, and a
  process that cannot be killed produces the failure from task 2.2 rather
  than a `cancelled`. Use a real child; a mock cannot fail to die.
- [ ] 5.4 `acp-session-driver.test.ts`: cancelling an ACP run does not
  emit `cancelled` before the process has exited.

  **Outstanding, and it is the one that matters most.** The report came
  from `copilot-cli-acp`, and `runProcess`'s new wait-for-exit path is
  the part of this change nothing yet exercises. The existing suite
  drives `run()` against an in-process ACP peer with no child, so it
  cannot reach the branch that waits on a real `close`. Writing it needs
  a fake child the test can hold open, which is the same shape
  `shared.test.ts` already uses — do that rather than leave the reported
  adapter covered only by its sibling.
- [x] 5.5 `HarnessChainPanel.test.tsx` and `AiPanel.test.tsx`: after a
  cancellation that has not taken effect — the in-flight event followed
  by more output — the Cancel control is still rendered and can be
  pressed again.
- [x] 5.6 Same: after a real `cancelled`, the control goes away as it
  does today. The fix must not leave a dead button on a finished run.

## 6. Verification

- [x] 6.1 `openspec change validate --strict cancel-reports-what-happened`.
- [x] 6.2 `npm run typecheck`, `npm run lint`, `npm run test` — green
  across all five workspaces. Typecheck and lint clean. Every suite green
  except `git.push.test.ts`, which is the intermittent Windows failure
  already tracked by `core-test-worker-contention` and untouched here.
- [x] 6.3 A run that is not cancelled produces a byte-identical event
  sequence to before this change. The new kind appears only when someone
  asks to cancel.
- [x] 6.4 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the packages whose event handling changed).
- [ ] 6.5 **Human-only, cannot be completed by an implementing agent**:
  reproduce the original report — a chain on `copilot-cli-acp`, Cancel
  pressed mid-stage — and confirm three things: the agent's process
  actually stops, the panel does not say "Cancelled" while output is
  still arriving, and the Cancel control is still there if it did not
  work. The first is the fix; the third is what makes the failure
  survivable when the first does not hold.
