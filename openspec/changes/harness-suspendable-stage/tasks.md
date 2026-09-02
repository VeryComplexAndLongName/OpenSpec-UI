Path this change must hold end to end: an execution calls `suspend()` →
the scheduler releases the in-process lock **and** the cross-host lease →
another mutating process is admitted and runs → the signal arrives → the
process re-enters the queue → it is admitted, re-acquires the lease, and
finishes. A suspension that releases one lock but not the other, or that
resumes without re-queueing, satisfies a naive test and breaks the
single-mutation invariant. Check each junction.

## 1. The state

- [x] 1.1 `packages/core/src/process-scheduler.ts`: add `"suspended"` to
  `WorkbenchProcessState`. Additive only — do not change the meaning of
  any existing state.
- [x] 1.2 Same file: `WorkbenchProcess` gains an optional field naming
  what the process is waiting for, set when it suspends and cleared when
  it resumes. This is what the UIs render; a suspended process with no
  stated reason is indistinguishable from a stalled one.
- [x] 1.3 Same file, the constructor's recovery loop: a persisted
  `"suspended"` process is rewritten to `"interrupted"`, alongside the
  `"queued"`/`"running"` cases already there, with a reason naming that
  the host owning the wait is gone. Do **not** restore it as suspended —
  see design.md; the poller and the awaited promise died with the host,
  so it could never be resumed.

## 2. Suspending and resuming

- [x] 2.1 `packages/core/src/process-scheduler.ts`,
  `ProcessExecutionContext`: add `suspend(reason: string, options: {
  timeoutMs: number }): Promise<void>`, which an execution awaits. It
  resolves when the process is resumed and rejects when the suspension
  times out or the process is cancelled.
- [x] 2.2 Same file: while a suspension is pending, the process's state is
  `"suspended"` and `mutationLocked` is **false**, so `drain()` may admit
  another mutating process. Call `drain()` on suspension — without it the
  released lock changes nothing until some unrelated process finishes.
- [x] 2.3 Same file: add `resumeProcess(id: string): boolean`, returning
  `false` for a process that is not suspended. A resumed process goes back
  to `"queued"` and is admitted by `drain()` under the existing
  `canRun()` rule. Do **not** set it directly to `"running"` — two
  processes suspended at once would both resume into a mutation.
- [x] 2.4 Same file: on timeout, the process finishes as `"failed"` with a
  reason naming what it was waiting for and how long it waited. Do not
  reuse a generic failure reason.
- [x] 2.5 Same file: cancelling a suspended process ends it immediately as
  `"cancelled"`, matching how cancelling a queued process already behaves.

## 3. The cross-host lease

- [x] 3.1 `packages/core/src/process-scheduler.ts`: on suspension, stop
  the lease renewal timer and release the lease, exactly as the existing
  `finally` block does at the end of a mutating run.
- [x] 3.2 Same file: when a resumed process is admitted, re-acquire the
  lease and restart the renewal timer before it runs again. A resume that
  cannot acquire the lease stays queued — it must **not** proceed without
  it.
- [x] 3.3 `packages/core/src/process-scheduler.test.ts`: with a stub lease
  manager, suspension releases and resume re-acquires; a resume whose
  acquisition fails leaves the process queued and unrun. (Uses a real
  `WorkspaceLeaseManager` over a temporary directory, matching this
  file's existing lease tests, rather than a stub — a live conflicting
  lease deterministically forces the acquisition-fails path.)

## 4. Persistence

- [x] 4.1 `packages/core/src/workbench-run-journal.ts`: a suspended
  process and its wait reason round-trip through the journal. Do not
  change the journal's version constant — the union widened, the format
  did not. (The journal already round-trips `WorkbenchProcess` opaquely,
  with no per-field validation, so no code change was needed here — added
  a test in `workbench-run-journal.test.ts` proving it.)
- [x] 4.2 `packages/core/src/workbench-recovery.ts`: recovery handles the
  suspended-to-interrupted rewrite from task 1.3 without special-casing it
  beyond what `"running"` already needs. (Verified: `initialize()`
  constructs its scheduler via `new WorkbenchProcessScheduler(restored.
  processes, this.lease)`, so the constructor's rewrite from task 1.3
  already applies before recovery's own `state !== "interrupted"` check
  runs — no code change needed.)

## 5. The external waiter

- [x] 5.1 New `packages/core/src/external-waiter.ts`: a generic poller —
  given a check function, an interval and a maximum duration, it calls the
  check on that interval and resolves when the check reports a change.
  Holds no lock and owns no process.
- [x] 5.2 Same file: it stops polling when it resolves, when it exceeds
  its maximum duration, and when its `AbortSignal` fires. A poller that
  outlives its consumer is a leak with no symptom.
- [x] 5.3 Same file: nothing GitHub-specific, and no import of `git.ts`,
  `openspec.ts` or any adapter. What is watched arrives with the consumer.
- [x] 5.4 `packages/core/src/external-waiter.test.ts`: resolves on the
  first check reporting a change; stops on abort; fails on its maximum
  duration; performs no further checks after any of the three.

- [ ] 5.5 `packages/core/src/external-waiter.ts` lines 43-44: eslint
  `prefer-const` — `intervalHandle` and `timeoutHandle` are never
  reassigned. Found by CI on PR #164, not locally, because `npm run lint`
  fails on this machine at `lint:english` (ENOENT on a concurrent
  session's uncommitted archive moves) **before** eslint runs at all.
  Run `npm run lint --workspace @openspec-ui/core`, which skips
  `lint:english` and reaches eslint, to verify the fix.

## 6. Presentation

- [x] 6.1 `packages/extension/src/tree/processes-tree.ts`: a suspended
  process renders as waiting, with its wait reason, distinctly from
  running. Do **not** render it as running — that is the confusion this
  state exists to remove.
- [x] 6.2 `packages/webui/src/components/ProcessesView.tsx`: the same, in
  the standalone UI.
- [x] 6.3 A percent-complete or progress indicator, if either surface
  computes one, must not treat a suspended process as making progress.
  (Both surfaces' `formatPercent` already derive solely from the
  associated change's `tasks.md` checkbox counts, never from process
  state — verified, no code change needed.)

## 7. End-to-end test

- [x] 7.1 `packages/core/src/process-scheduler.test.ts`: one test covering
  the whole path — a mutating process suspends; a second mutating process
  is admitted **and finishes** while the first waits; the first is
  resumed, is admitted, and completes. Assert the second process actually
  ran: a test that only checks states would pass even if the lock were
  never really released.
- [x] 7.2 Same file: a suspension that times out fails the process and
  leaves the lock free for the next queued mutation.

## 8. Verification

- [x] 8.1 `openspec change validate --strict harness-suspendable-stage`.
- [x] 8.2 `npm run typecheck` and `npm run test` — green across all four
  workspaces. `sprint-report.test.ts` and `change-timeline.test.ts` have
  pre-existing Windows timeout flakes at 5000 ms under load; do not
  attempt to fix them here. (All green this run, including those two.)
- [x] 8.3 `git diff packages/core/src/agents/` and `git diff
  packages/core/src/harness-chain-runner.ts` are both **empty**. This
  change adds a mechanism; wiring a stage to it belongs to the change that
  has a stage to wire.
- [x] 8.4 Version bump via `npx changeset` (`@openspec-ui/core` minor,
  plus the packages whose views changed). (`.changeset/
  harness-suspendable-stage.md`: `@openspec-ui/core` minor,
  `openspec-ui-vscode`/`@openspec-ui/webui` patch for their Processes
  view rendering.)
- [ ] 8.5 **Human-only, cannot be completed by an implementing agent**:
  with a temporary command that suspends for a few seconds and resumes,
  confirm in a real UI that the process shows as waiting, that another
  mutating action can be started and completes while it waits, and that
  the first one then finishes. Leave unchecked if you are an agent.
