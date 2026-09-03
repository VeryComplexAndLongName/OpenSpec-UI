## Context

See `proposal.md` and ADR 0018 (gap 2, decision 2). Facts read from the
code, not recalled:

- `WorkbenchProcessScheduler.canRun()` is `!process.mutating ||
  !this.mutationLocked`; `mutationLocked` is one private boolean set in
  `run()` and cleared in its `finally`. `drain()` re-examines the queue
  whenever a process finishes.
- `WorkbenchProcessState` is `queued | running | completed | failed |
  cancelled | interrupted | rolled-back`.
- The scheduler's constructor already rewrites a persisted `queued` or
  `running` process to `interrupted` with the reason "Workbench host
  stopped before this process completed" — the precedent for how a state
  that cannot survive a restart is handled.
- `WorkspaceLeaseManager` is renewed on a timer (`setInterval` at
  `WORKSPACE_LEASE_RENEW_INTERVAL_MS`) for the duration of a mutating run
  and released in the same `finally`.
- ADR 0004 decision 4 permits only one mutating run per workspace "until
  mutations are isolated by worktrees or an equivalent filesystem
  boundary".

## Goals / Non-Goals

**Goals:**

- Let a stage wait on an external system without holding the workspace's
  mutation lock.
- Make waiting visible as waiting, in the journal and in both UIs.
- Bound every wait in time, so a suspended stage cannot become a silent
  permanent leak.

**Non-Goals (this change):**

- The `git` stage, and any GitHub-specific polling.
- Concurrency beyond what ADR 0004 decision 4 already permits. Releasing
  the lock lets *other* work proceed while one stage waits; it does not
  permit two mutations at once.
- Removing polling. Where an external system offers no callback, polling
  is the only option; this change confines it to one module that holds no
  lock.

## Decisions

### A resumed process re-enters the queue; it does not resume straight into `running`

On resume, the process returns to `queued` and `drain()` admits it under
the same `canRun()` rule as anything else.

**Rejected alternative**: resume directly to `running`. Rejected — two
processes suspended at the same time would both resume into a mutation,
and the single-mutation invariant (ADR 0004 decision 4) would be violated
by exactly the mechanism meant to respect it. Re-queueing costs a resumed
stage some latency and buys the invariant for free.

### Suspension releases the cross-host lease, and resume must re-acquire it

The `WorkspaceLeaseManager` lease is released on suspension along with the
in-process lock, and re-acquired when the resumed process is admitted.

**Rejected alternative**: hold the lease across the suspension while
releasing only the in-process lock. Rejected — the lease exists so a
second host does not mutate the same workspace; holding it through a wait
would block the other host for precisely the duration this change exists
to give back. A resume that cannot re-acquire it waits in the queue, which
is what the queue is for.

### Every suspension is bounded

A suspension carries a maximum duration. On expiry the process fails with
a reason naming what it was waiting for.

**Rejected alternative**: unbounded suspension, ended only by the signal
or by cancellation. Rejected — an external system that never answers would
leave a process suspended forever. It would no longer hold the lock, so
the symptom would be *silence* rather than a stall, which is worse: the
chain simply never continues and nothing says why. This is the same
reasoning that put an iteration cap on the review loop.

### A suspended process does not survive a host restart

On load, a persisted `suspended` process is rewritten to `interrupted`,
exactly as `queued` and `running` already are.

**Rejected alternative**: restore it as suspended and keep waiting.
Rejected — the wait belongs to a host process that is gone: the poller,
its interval, and the in-memory promise the execution was awaiting all
died with it. Restoring the *state* without the machinery would produce a
process that is suspended and can never be resumed, which is the
permanent leak the bound above exists to prevent.

### Polling lives in exactly one module, and holds nothing

`external-waiter.ts` owns the only interval in this project's runtime
path. It holds no lock, owns no process, and reports state changes to
whoever asked.

**Rejected alternative**: let each consumer poll for itself. Rejected —
polling that holds a lock is the failure this change is fixing, and the
cheapest way to reintroduce it is to let every consumer write its own
loop. One module also gives one place to add a webhook path later, if a
public endpoint ever exists.

## Risks / Trade-offs

- **[Risk]** This ships a mechanism with no consumer: nothing in the
  repository suspends until the `git` stage (ADR 0014) lands. An unused
  mechanism can be wrong in ways only a real consumer reveals. →
  **Mitigation**: stated rather than hidden. The tasks require an
  end-to-end test through a fake external waiter — suspend, lock observed
  released, another mutating process admitted and finished, signal, resume,
  completion — plus a human-only smoke test that exercises the same path
  live. The alternative, landing it inside the `git` stage's own change,
  would mix a scheduler-invariant change with a change that pushes commits;
  a defect in the first would be found while reviewing the second.
- **[Risk]** Releasing the lock mid-run means another mutating process can
  change files under a suspended stage, so the checkpoint it opened may no
  longer describe the tree it will resume into. → **Mitigation**: this is
  the existing conflict path — `RollbackResult.conflicts` already reports
  files that changed after a checkpoint was finalized. Worktree isolation
  (ADR 0004 decision 4) is what removes the risk rather than reporting it.
- **[Trade-off]** A resumed stage may wait behind other queued work.
  Accepted; the alternative violates the single-mutation invariant.

## Migration Plan

Additive. A new state value is added to a union that consumers already
switch over; the widening is the same one `agentic-harness-autonomy` and
`harness-stage-dispatch` each performed for their new kinds. Journals
written before this change contain no suspended processes, and journals
written after it are read by older code as an unknown state — which is why
the journal's existing version check matters and is left untouched.

## Open Questions

None. What a suspension actually waits for arrives with its first
consumer, by design.
