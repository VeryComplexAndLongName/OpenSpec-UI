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
- [x] 5.4 `acp-session-driver.test.ts`: cancelling an ACP run does not
  emit `cancelled` before the process has exited.

  Covered by a held-open fake child in `runProcess()`: after abort, its
  terminal `next()` remains pending until the test emits the child's
  `close` event, at which point it yields `cancelled`. This exercises the
  reported ACP adapter's wait-for-exit path rather than only `run()`'s
  in-process peer path.
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
- [x] 6.5 **Human-only, cannot be completed by an implementing agent**:
  reproduce the original report — a chain on `copilot-cli-acp`, Cancel
  pressed mid-stage — and confirm three things: the agent's process
  actually stops, the panel does not say "Cancelled" while output is
  still arriving, and the Cancel control is still there if it did not
  work. The first is the fix; the third is what makes the failure
  survivable when the first does not hold.

## 7. Reopened by task 6.5, 2026-09-03

The human check found the fix did not work. A chain on `copilot-cli-acp`,
Cancel pressed four times: four "cancel" entries appeared in Processes and
hung, and the agent finished its work undisturbed. Three separate defects,
one of them introduced by this change.

- [x] 7.1 **A cancellation went to the wrong runner, so nothing was ever
  aborted.** The webview sends no `agentId` on a cancel — it does not know
  one — so `resolveRunner(command.agentId)` fell through to
  `DEFAULT_AGENT_ID` and handed the cancel to `claude-cli`'s runner.
  `activeRuns` is a closure per runner instance, so the run registered
  under `copilot-cli-acp` was invisible to it: the cancel reported
  "nothing to cancel" and the agent carried on.

  **Cancelling any agent other than `claude-cli` had never worked.** This
  change only made the failure legible, by giving the report an
  `attempted` field. `AiPanel` now remembers which agent each `runId` was
  started against and routes the cancel there.

- [x] 7.2 **A regression from this change: cancel processes that never
  end.** Because 7.1 sent the cancel down the ordinary-command path,
  `trackHarnessProcess` registered a `WorkbenchProcess` whose `execute`
  promise waits for `completed`/`failed`/`cancelled`. Before this change a
  cancel emitted `cancelled` and the promise settled; now it emits
  `cancelling`, which fell into `default: return` — so the promise never
  settled and each press left an entry hanging forever.

  Two fixes, because either alone leaves the other latent: a cancel no
  longer registers a process at all, and that `switch` lists every
  non-terminal kind by name instead of a bare `default`.

- [x] 7.3 **`default:` is where a protocol change goes unnoticed.** Adding
  `cancelling` failed the build in the two exhaustive switches over
  `Event["kind"]` and said nothing here, because a `default` handles
  everything including what it has never heard of. The two that broke were
  the two that were safe. Worth remembering the next time an event kind is
  added.

- [x] 7.4 **The extension's chain path emitted nothing on a successful
  cancel.** `chainRunner.cancel()` returning `true` simply returned, so
  between the click and the chain's own `cancelled` — which now arrives
  only once the process is gone — the panel showed nothing at all. It now
  posts `cancelling`, the same event the standalone host gets from
  `asAgentRunner()`, which this path bypasses.

- [x] 7.5 Tests for 7.1 and 7.2, both verified to fail with the fix
  removed and pass with it — checked by actually reverting the two guards
  and re-running, not by reasoning about it.

- [x] 7.6 **Human-only**: repeat 6.5 on `copilot-cli-acp`. The agent's
  process must stop; no "cancel" entry may appear in Processes; and the
  panel must say it is cancelling rather than nothing at all.
