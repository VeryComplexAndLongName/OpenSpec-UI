## Why

`docs/adr/0018-event-driven-harness-orchestration.md`, gap 2 and decision
2: a stage that must wait on an external system can only block, and while
it blocks it holds the workspace's single mutation lock.

That lock is not incidental. `WorkbenchProcessScheduler.canRun()` is
`!process.mutating || !this.mutationLocked` — one boolean, workspace-wide,
extended across hosts by `WorkspaceLeaseManager` (ADR 0010). Everything
mutating in the workspace stops for as long as one stage waits.

`WorkbenchProcessState` offers no alternative: `queued | running |
completed | failed | cancelled | interrupted | rolled-back`. There is no
state meaning "not working, waiting for something outside".

The wait is real and it is long. This repository's own CI takes 1-3
minutes for a normal run; on 2026-09-01 a stuck runner sat for 25 minutes
on a job that normally finishes in 50 seconds, and there are no
`timeout-minutes` in the workflows, so the ceiling is GitHub's 6-hour
default. ADR 0014's `git` stage is specified to push, open a pull request
and merge — which means waiting for exactly that. Under today's model such
a stage would hold the whole workspace hostage for the duration.

This change adds the state and the mechanism. It does not add the `git`
stage, which is ADR 0014's own change and this mechanism's first consumer.

## What Changes

- `packages/core/src/process-scheduler.ts`: `WorkbenchProcessState` gains
  `"suspended"`. A suspended process releases the mutation lock, and on
  resume re-enters the queue rather than resuming directly into
  `running` — so two suspended processes cannot both resume into a
  mutation at once.
- Same file: `ProcessExecutionContext` gains a way for a running execution
  to suspend itself until a named external signal arrives, and the
  scheduler gains a way to deliver that signal.
- Same file: a suspension has a maximum duration, after which the process
  fails with a reason naming what it was waiting for. A suspended stage
  waiting forever is the same failure as a blocked one, minus the lock.
- `packages/core/src/workspace-lease.ts`: the cross-host lease is released
  on suspension and re-acquired on resume. A resume that cannot re-acquire
  it waits like any other queued mutation rather than proceeding unlocked.
- `packages/core/src/workbench-run-journal.ts` and the recovery path: a
  suspended process is persisted and, on host restart, is recovered as
  `interrupted` — the host that owned the external wait is gone, and
  nothing else can answer for it.
- New `packages/core/src/external-waiter.ts`: a generic, lock-free poller
  that watches an external condition on an interval and emits when it
  changes. Owns no lock, holds no process, and is the only place in this
  project permitted to poll.

## Capabilities

### New Capabilities

(none — this extends `persistent-workbench-runs` and `agentic-harness`)

### Modified Capabilities

- `persistent-workbench-runs`: a process may be suspended awaiting an
  external signal, releasing the workspace mutation lock; suspension is
  persisted, bounded in time, and recovered on restart.
- `agentic-harness`: a chain stage may wait on an external system without
  blocking the workspace.

## Impact

- `packages/core`: `process-scheduler.ts`, `workspace-lease.ts`,
  `workbench-run-journal.ts`, `workbench-recovery.ts`, plus one new
  module.
- `packages/extension`, `packages/webui`: the Processes view shows a
  suspended process as waiting, distinctly from running — a suspended
  stage that looks like a running one is the confusion this state exists
  to remove.
- No change to the command/event protocol, to any adapter, or to
  `HarnessChainRunner`'s stage sequence.

## Explicitly out of scope

- The `git` stage itself — `agentic-harness-git-stage` / ADR 0014. This
  change is its precondition, not its implementation.
- Any GitHub-specific polling. `external-waiter.ts` is generic; what it
  watches arrives with its consumer.
- The `apply ⇄ verify` loop (`harness-review-loop`) and change-level
  scheduling (`harness-change-scheduler`).
- Adding `timeout-minutes` to the CI workflows. Worth doing, unrelated to
  this mechanism, and its own small change.
